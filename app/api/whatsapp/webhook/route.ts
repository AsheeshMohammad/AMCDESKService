import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { toWhatsAppE164 } from '@/lib/whatsapp'

type IncomingMessage = {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
}

type MessageStatus = { id?: string; status?: string }
type WebhookValue = {
  metadata?: { phone_number_id?: string }
  messages?: IncomingMessage[]
  statuses?: MessageStatus[]
}
type WebhookPayload = {
  entry?: { changes?: { value?: WebhookValue }[] }[]
}

const deliveryStatuses = new Set(['sent', 'delivered', 'read', 'failed'])

function matchesSecret(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export async function GET(request: Request) {
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) return Response.json({ error: 'WhatsApp webhook verification is not configured.' }, { status: 503 })
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode') ?? ''
  const token = url.searchParams.get('hub.verify_token') ?? ''
  const challenge = url.searchParams.get('hub.challenge') ?? ''
  if (mode === 'subscribe' && challenge && matchesSecret(token, verifyToken)) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new Response('Webhook verification failed.', { status: 403 })
}

export async function POST(request: Request) {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET
  const tenantId = process.env.META_WHATSAPP_TENANT_ID
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!appSecret || !tenantId || !phoneNumberId || !supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'WhatsApp webhook server configuration is incomplete.' }, { status: 503 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 1_000_000) return Response.json({ error: 'Webhook payload is too large.' }, { status: 413 })
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  const [algorithm, receivedDigest] = signature.split('=')
  if (algorithm !== 'sha256' || !/^[a-f0-9]{64}$/i.test(receivedDigest ?? '')) {
    return Response.json({ error: 'Webhook signature is missing or invalid.' }, { status: 401 })
  }

  const rawBody = await request.text()
  const expectedDigest = createHmac('sha256', appSecret).update(rawBody).digest()
  const receivedBytes = Buffer.from(receivedDigest, 'hex')
  if (receivedBytes.length !== expectedDigest.length || !timingSafeEqual(receivedBytes, expectedDigest)) {
    return Response.json({ error: 'Webhook signature verification failed.' }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return Response.json({ error: 'Webhook payload must be valid JSON.' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (value?.metadata?.phone_number_id !== phoneNumberId) continue

      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status || !deliveryStatuses.has(status.status)) continue
        const { error } = await supabase
          .from('whatsapp_messages')
          .update({ delivery_status: status.status })
          .eq('tenant_id', tenantId)
          .eq('external_message_id', status.id)
        if (error) return Response.json({ error: `Could not update message status: ${error.message}` }, { status: 500 })
      }

      for (const message of value.messages ?? []) {
        if (!message.id || !message.from || !message.timestamp) continue
        const sender = toWhatsAppE164(message.from)
        const timestamp = Number(message.timestamp)
        if (!sender || !Number.isFinite(timestamp) || timestamp <= 0) continue

        const { data: customers, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('whatsapp_phone_e164', sender)
          .limit(2)
        if (customerError) return Response.json({ error: `Could not match inbound customer: ${customerError.message}` }, { status: 500 })
        if (!customers || customers.length !== 1) continue

        const body = typeof message.text?.body === 'string'
          ? message.text.body
          : `WhatsApp ${message.type || 'unsupported'} message`
        const { error: insertError } = await supabase
          .from('whatsapp_messages')
          .upsert({
            tenant_id: tenantId,
            customer_id: customers[0].id,
            direction: 'inbound',
            body,
            sent_at: new Date(timestamp * 1000).toISOString(),
            delivery_status: 'delivered',
            external_message_id: message.id,
          }, { onConflict: 'tenant_id,external_message_id', ignoreDuplicates: true })
        if (insertError) return Response.json({ error: `Could not save inbound message: ${insertError.message}` }, { status: 500 })
      }
    }
  }

  return Response.json({ received: true })
}
