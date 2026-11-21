import { createClient } from '@supabase/supabase-js'
import { toWhatsAppE164 } from '@/lib/whatsapp'

type SendRequest = {
  tenantId?: unknown
  customerId?: unknown
  message?: unknown
}

type MetaSendResponse = {
  messages?: { id?: string }[]
  error?: { message?: string; error_user_title?: string }
}

const managerRoles = new Set(['owner', 'admin', 'manager'])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!accessToken) return jsonError('Sign in before sending a WhatsApp message.', 401)

  let body: SendRequest
  try {
    body = await request.json() as SendRequest
  } catch {
    return jsonError('Request body must be valid JSON.', 400)
  }
  if (typeof body.tenantId !== 'string' || !uuidPattern.test(body.tenantId)
    || typeof body.customerId !== 'string' || !uuidPattern.test(body.customerId)
    || typeof body.message !== 'string') {
    return jsonError('Select a customer and enter a message.', 400)
  }
  const tenantId = body.tenantId
  const customerId = body.customerId
  const message = body.message.trim()
  if (!message || message.length > 4096) return jsonError('Messages must be between 1 and 4,096 characters.', 400)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return jsonError('Supabase is not configured on the server.', 503)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !userResult.user) return jsonError('Your session is invalid or expired. Sign in again.', 401)

  const { data: membership, error: membershipError } = await supabase
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userResult.user.id)
    .maybeSingle()
  if (membershipError) return jsonError(`Could not verify workspace access: ${membershipError.message}`, 500)
  if (!membership || !managerRoles.has(membership.role)) return jsonError('You do not have permission to send workspace messages.', 403)

  const configuredTenantId = process.env.META_WHATSAPP_TENANT_ID
  const accessKey = process.env.META_WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
  const graphVersion = process.env.META_GRAPH_API_VERSION
  if (!configuredTenantId || !accessKey || !phoneNumberId || !graphVersion) {
    return jsonError('Meta WhatsApp is not configured. Set its server-only credentials and workspace ID.', 503)
  }
  if (configuredTenantId !== tenantId) return jsonError('WhatsApp is not configured for this workspace.', 403)
  if (!uuidPattern.test(configuredTenantId) || !/^\d+$/.test(phoneNumberId) || !/^v\d+\.\d+$/.test(graphVersion)) {
    return jsonError('Meta WhatsApp configuration is invalid.', 503)
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, full_name, phone, whatsapp_phone_e164, whatsapp_opt_in')
    .eq('tenant_id', tenantId)
    .eq('id', customerId)
    .maybeSingle()
  if (customerError) return jsonError(`Could not load customer: ${customerError.message}`, 500)
  if (!customer) return jsonError('Customer was not found in this workspace.', 404)
  if (!customer.whatsapp_opt_in) return jsonError('This customer has not opted in to WhatsApp messages.', 403)

  const e164 = customer.whatsapp_phone_e164 || toWhatsAppE164(customer.phone)
  if (!e164 || !/^\+[1-9]\d{7,14}$/.test(e164)) return jsonError('This customer does not have a valid WhatsApp number.', 400)

  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: lastInbound, error: inboundError } = await supabase
    .from('whatsapp_messages')
    .select('sent_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('direction', 'inbound')
    .gte('sent_at', windowStart)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (inboundError) return jsonError(`Could not verify the customer service window: ${inboundError.message}`, 500)
  if (!lastInbound) return jsonError('The customer must message your WhatsApp number first. Replies are available for 24 hours after their latest message.', 409)

  const { data: queuedMessage, error: queueError } = await supabase
    .from('whatsapp_messages')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      direction: 'outbound',
      body: message,
      delivery_status: 'queued',
    })
    .select('id')
    .single()
  if (queueError || !queuedMessage) return jsonError(`Could not record the outgoing message: ${queueError?.message ?? 'No message record was returned.'}`, 500)

  const markFailed = async () => {
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ delivery_status: 'failed' })
      .eq('tenant_id', tenantId)
      .eq('id', queuedMessage.id)
    return error
  }

  let metaResponse: Response
  try {
    metaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: e164.slice(1),
        type: 'text',
        text: { body: message, preview_url: false },
      }),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Network request failed.'
    const updateError = await markFailed()
    return jsonError(`Could not reach Meta: ${detail}${updateError ? ` Message status update failed: ${updateError.message}` : ''}`, 502)
  }

  let metaResult: MetaSendResponse
  try {
    metaResult = await metaResponse.json() as MetaSendResponse
  } catch {
    const updateError = await markFailed()
    return jsonError(`Meta returned an unreadable response.${updateError ? ` Message status update failed: ${updateError.message}` : ''}`, 502)
  }
  if (!metaResponse.ok) {
    const providerMessage = metaResult.error?.error_user_title || metaResult.error?.message || `Meta returned HTTP ${metaResponse.status}.`
    const updateError = await markFailed()
    return jsonError(`${providerMessage}${updateError ? ` Message status update failed: ${updateError.message}` : ''}`, 502)
  }
  const externalMessageId = metaResult.messages?.[0]?.id
  if (!externalMessageId) {
    const updateError = await markFailed()
    return jsonError(`Meta did not return a message ID.${updateError ? ` Message status update failed: ${updateError.message}` : ''}`, 502)
  }

  const { error: saveError } = await supabase
    .from('whatsapp_messages')
    .update({
      delivery_status: 'sent',
      external_message_id: externalMessageId,
      sent_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', queuedMessage.id)
  return Response.json({
    sent: true,
    warning: saveError ? `Meta accepted the message, but its final status could not be saved: ${saveError.message}` : undefined,
  })
}
