'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, MessageCircle, Plus,
  RefreshCw, Search, ShieldCheck, Users, Wrench,
} from 'lucide-react'
import { getSupabaseClient, money } from '@/lib/supabase'
import ReportChart, { type ReportChartType } from '@/components/report-chart'
import { toWhatsAppE164 } from '@/lib/whatsapp'

export type ViewKey =
  | 'Dashboard' | 'WhatsApp Inbox' | 'WhatsApp Automation' | 'SERVICE STATUS' | 'Customers 360'
  | 'Services & Jobs' | 'Service Calendar' | 'AMC Management' | 'Technicians' | 'Inventory Spares'
  | 'RO Sales & Catalog' | 'Invoices & Billing' | 'Business Reports' | 'Business Settings'

type Props = {
  page: ViewKey
  tenantId: string
  role: string | undefined
  theme: 'light' | 'dark'
  tenant: TenantProfile
  onToast: (message: string) => void
  onNavigate: (page: ViewKey) => void
  onTenantUpdated: (tenant: TenantProfile) => void
}

type Row = Record<string, unknown>
type DashboardSummary = {
  customer_count: number
  active_contract_count: number
  expiring_contract_count: number
  jobs_today: number
  overdue_jobs: number
  pending_invoice_amount: number
  revenue_this_month: number
}
type ReportData = {
  customers: { created_at: string }[]
  jobs: { scheduled_at: string; status: string }[]
  contracts: { ends_on: string }[]
  invoices: { paid_at: string; total: number }[]
}
type ReportMetric = 'customers' | 'jobs' | 'job-status' | 'contracts' | 'revenue'
type TenantProfile = {
  id: string
  name: string
  slug: string
  owner_name: string
  updated_at: string
  city: string | null
  business_phone: string | null
  business_email: string | null
  address: string | null
  gstin: string | null
  upi_id: string | null
  custom_domain: string | null
}

const pageConfig: Record<ViewKey, { table: string; title: string; description: string; columns: string[] }> = {
  Dashboard: { table: '', title: 'Dashboard', description: 'Live operational summary for this workspace.', columns: [] },
  'Customers 360': { table: 'customers', title: 'Customers', description: 'Customer records belonging to this workspace.', columns: ['customer_code', 'full_name', 'phone', 'email', 'area', 'city', 'whatsapp_opt_in'] },
  'Services & Jobs': { table: 'service_jobs', title: 'Services & Jobs', description: 'Scheduled and completed service work.', columns: ['job_number', 'customer', 'service_type', 'technician', 'scheduled_at', 'status'] },
  'SERVICE STATUS': { table: 'service_jobs', title: 'Service status', description: 'Current field-service jobs and their status.', columns: ['job_number', 'customer', 'service_type', 'technician', 'scheduled_at', 'status'] },
  'Service Calendar': { table: 'service_jobs', title: 'Service calendar', description: 'Upcoming scheduled visits.', columns: ['job_number', 'customer', 'service_type', 'technician', 'scheduled_at', 'status'] },
  'AMC Management': { table: 'amc_contracts', title: 'AMC contracts', description: 'Maintenance contracts and renewal dates.', columns: ['contract_number', 'customer', 'tier', 'starts_on', 'ends_on', 'amount', 'status'] },
  Technicians: { table: 'technicians', title: 'Technicians', description: 'Your active field-service team.', columns: ['full_name', 'phone', 'area', 'pin_code', 'is_active'] },
  'Inventory Spares': { table: 'inventory_spares', title: 'Inventory spares', description: 'Stock levels and reorder thresholds.', columns: ['sku', 'name', 'quantity', 'minimum_quantity', 'unit_cost', 'unit'] },
  'Invoices & Billing': { table: 'invoices', title: 'Invoices & billing', description: 'Customer invoices and payment status.', columns: ['invoice_number', 'customer', 'description', 'total', 'status', 'issued_at'] },
  'RO Sales & Catalog': { table: 'ro_catalog', title: 'RO sales & catalog', description: 'Products and live stock quantities.', columns: ['name', 'category', 'mrp', 'dealer_price', 'stock_quantity'] },
  'WhatsApp Inbox': { table: 'whatsapp_messages', title: 'WhatsApp inbox', description: 'Messages received and sent through configured integrations.', columns: ['customer', 'direction', 'body', 'delivery_status', 'sent_at'] },
  'WhatsApp Automation': { table: 'notification_rules', title: 'WhatsApp automation', description: 'Workspace notification rules and their current settings.', columns: ['name', 'channel', 'trigger_type', 'is_enabled', 'updated_at'] },
  'Business Reports': { table: '', title: 'Business reports', description: 'Live totals calculated from this workspace’s records.', columns: [] },
  'Business Settings': { table: '', title: 'Business settings', description: 'Workspace details stored in Supabase.', columns: [] },
}

const relationSelects: Partial<Record<ViewKey, string>> = {
  'Services & Jobs': '*, customer:customers!service_jobs_customer_tenant_fk(full_name), technician:technicians!service_jobs_technician_tenant_fk(full_name)',
  'SERVICE STATUS': '*, customer:customers!service_jobs_customer_tenant_fk(full_name), technician:technicians!service_jobs_technician_tenant_fk(full_name)',
  'Service Calendar': '*, customer:customers!service_jobs_customer_tenant_fk(full_name), technician:technicians!service_jobs_technician_tenant_fk(full_name)',
  'AMC Management': '*, customer:customers!amc_contracts_customer_tenant_fk(full_name)',
  'Invoices & Billing': '*, customer:customers!invoices_customer_tenant_fk(full_name)',
  'WhatsApp Inbox': '*, customer:customers!whatsapp_messages_customer_tenant_fk(full_name)',
}

function valueFor(row: Row, column: string) {
  if (column === 'customer' || column === 'technician') {
    const relation = row[column]
    return typeof relation === 'object' && relation !== null
      ? String((relation as Row).full_name ?? '—')
      : '—'
  }
  const value = row[column]
  if (value === null || value === undefined || value === '') return '—'
  if (column === 'amount' || column === 'total' || column === 'mrp' || column === 'dealer_price' || column === 'unit_cost') return money(String(value))
  if (column === 'is_active' || column === 'is_enabled') return value ? 'Active' : 'Inactive'
  if (column === 'whatsapp_opt_in') return value ? 'Opted in' : 'Not opted in'
  if (column.endsWith('_at') && typeof value === 'string') return new Date(value).toLocaleString()
  return String(value)
}

const snapshotFreshMs = 30_000
const snapshotMaxAgeMs = 10 * 60_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDashboardSummary(value: unknown): value is DashboardSummary {
  const fields: (keyof DashboardSummary)[] = [
    'customer_count', 'active_contract_count', 'expiring_contract_count', 'jobs_today',
    'overdue_jobs', 'pending_invoice_amount', 'revenue_this_month',
  ]
  return isRecord(value) && fields.every((field) => typeof value[field] === 'number' && Number.isFinite(value[field]))
}

function isReportData(value: unknown): value is ReportData {
  return isRecord(value)
    && Array.isArray(value.customers)
    && value.customers.every((row) => isRecord(row) && typeof row.created_at === 'string')
    && Array.isArray(value.jobs)
    && value.jobs.every((row) => isRecord(row) && typeof row.scheduled_at === 'string' && typeof row.status === 'string')
    && Array.isArray(value.contracts)
    && value.contracts.every((row) => isRecord(row) && typeof row.ends_on === 'string')
    && Array.isArray(value.invoices)
    && value.invoices.every((row) => isRecord(row) && typeof row.paid_at === 'string' && typeof row.total === 'number')
}

function readWorkspaceSnapshot<T>(
  key: string,
  isValue: (value: unknown) => value is T,
): { savedAt: number; value: T } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const stored: unknown = JSON.parse(raw)
    if (!isRecord(stored) || typeof stored.savedAt !== 'number' || !isValue(stored.value)) {
      window.sessionStorage.removeItem(key)
      return null
    }
    if (Date.now() - stored.savedAt > snapshotMaxAgeMs) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return { savedAt: stored.savedAt, value: stored.value }
  } catch (error) {
    console.warn('Could not restore a cached workspace summary; loading fresh data.', error)
    return null
  }
}

function writeWorkspaceSnapshot<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }))
  } catch (error) {
    console.warn('Could not cache the workspace summary; fresh data will load next time.', error)
  }
}

function invalidateWorkspaceSnapshots(tenantId: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(`amc-desk:snapshot:${tenantId}:dashboard`)
  window.sessionStorage.removeItem(`amc-desk:snapshot:${tenantId}:reports`)
}

export default function Workspace({ page, tenantId, role, theme, tenant, onToast, onNavigate, onTenantUpdated }: Props) {
  const supabase = getSupabaseClient()
  const config = pageConfig[page]
  const dashboardSnapshotKey = `amc-desk:snapshot:${tenantId}:dashboard`
  const reportsSnapshotKey = `amc-desk:snapshot:${tenantId}:reports`
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(() =>
    page === 'Dashboard' ? readWorkspaceSnapshot(dashboardSnapshotKey, isDashboardSummary)?.value ?? null : null)
  const [reportData, setReportData] = useState<ReportData | null>(() =>
    page === 'Business Reports' ? readWorkspaceSnapshot(reportsSnapshotKey, isReportData)?.value ?? null : null)
  const [customerOptions, setCustomerOptions] = useState<Row[]>([])
  const [technicianOptions, setTechnicianOptions] = useState<Row[]>([])
  const [bookingCustomerSearch, setBookingCustomerSearch] = useState('')
  const [loading, setLoading] = useState(() => {
    if (page === 'Dashboard') return readWorkspaceSnapshot(dashboardSnapshotKey, isDashboardSummary) === null
    if (page === 'Business Reports') return readWorkspaceSnapshot(reportsSnapshotKey, isReportData) === null
    return true
  })
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showJobForm, setShowJobForm] = useState(false)
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false)
  const [whatsAppError, setWhatsAppError] = useState('')
  const [createRecordPage, setCreateRecordPage] = useState<ViewKey | null>(null)
  const [saving, setSaving] = useState(false)
  const pageSize = 50
  const canManage = role === 'owner' || role === 'admin' || role === 'manager'
  const canUpdateJobs = canManage || role === 'technician'

  const loadData = useCallback(async (force = false) => {
    if (!supabase) return
    const cachedSnapshot = page === 'Dashboard'
      ? readWorkspaceSnapshot(dashboardSnapshotKey, isDashboardSummary)
      : page === 'Business Reports'
        ? readWorkspaceSnapshot(reportsSnapshotKey, isReportData)
        : null
    if (!force && cachedSnapshot && Date.now() - cachedSnapshot.savedAt < snapshotFreshMs) {
      setLoading(false)
      setError('')
      return
    }
    setLoading(cachedSnapshot === null)
    setError('')
    try {
      if (page === 'Business Reports') {
      const now = new Date()
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      const startDate = start.toISOString().slice(0, 10)
      const endDate = end.toISOString().slice(0, 10)
      const [customersResult, jobsResult, contractsResult, invoicesResult] = await Promise.all([
        supabase.from('customers').select('created_at').eq('tenant_id', tenantId).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).order('created_at').limit(1000),
        supabase.from('service_jobs').select('scheduled_at, status').eq('tenant_id', tenantId).gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()).order('scheduled_at').limit(1000),
        supabase.from('amc_contracts').select('ends_on').eq('tenant_id', tenantId).gte('ends_on', startDate).lt('ends_on', endDate).order('ends_on').limit(1000),
        supabase.from('invoices').select('paid_at, total').eq('tenant_id', tenantId).eq('status', 'Paid').gte('paid_at', start.toISOString()).lt('paid_at', end.toISOString()).order('paid_at').limit(1000),
      ])
      const resultError = [customersResult.error, jobsResult.error, contractsResult.error, invoicesResult.error].find(Boolean)
      if (resultError) setError(resultError.message)
      else {
        const freshReportData = {
          customers: customersResult.data ?? [],
          jobs: jobsResult.data ?? [],
          contracts: contractsResult.data ?? [],
          invoices: (invoicesResult.data ?? []).flatMap((invoice) => invoice.paid_at
          ? [{ paid_at: invoice.paid_at, total: Number(invoice.total ?? 0) }]
          : []),
        }
        setReportData(freshReportData)
        writeWorkspaceSnapshot(reportsSnapshotKey, freshReportData)
      }
      setRows([])
      } else if (page === 'Dashboard') {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
      const [
        customersResult,
        activeContractsResult,
        expiringContractsResult,
        jobsTodayResult,
        overdueJobsResult,
        unpaidInvoicesResult,
        revenueResult,
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('amc_contracts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).lte('starts_on', now.toISOString().slice(0, 10)).gte('ends_on', now.toISOString().slice(0, 10)),
        supabase.from('amc_contracts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).lte('starts_on', now.toISOString().slice(0, 10)).gte('ends_on', now.toISOString().slice(0, 10)).lte('ends_on', new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString().slice(0, 10)),
        supabase.from('service_jobs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('scheduled_at', todayStart).lt('scheduled_at', tomorrow).neq('status', 'Cancelled'),
        supabase.from('service_jobs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).lt('scheduled_at', now.toISOString()).not('status', 'in', '(Completed,Cancelled)'),
        supabase.from('invoices').select('total').eq('tenant_id', tenantId).in('status', ['Pending', 'Overdue']),
        supabase.from('invoices').select('total').eq('tenant_id', tenantId).eq('status', 'Paid').gte('paid_at', monthStart),
      ])
      const results = [
        customersResult.error,
        activeContractsResult.error,
        expiringContractsResult.error,
        jobsTodayResult.error,
        overdueJobsResult.error,
        unpaidInvoicesResult.error,
        revenueResult.error,
      ].find(Boolean)
      if (results) setError(results.message)
      else {
        const freshSummary = {
          customer_count: customersResult.count ?? 0,
          active_contract_count: activeContractsResult.count ?? 0,
          expiring_contract_count: expiringContractsResult.count ?? 0,
          jobs_today: jobsTodayResult.count ?? 0,
          overdue_jobs: overdueJobsResult.count ?? 0,
          pending_invoice_amount: (unpaidInvoicesResult.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
          revenue_this_month: (revenueResult.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        }
        setSummary(freshSummary)
        writeWorkspaceSnapshot(dashboardSnapshotKey, freshSummary)
      }
      setRows([])
      } else if (page === 'Business Settings') {
      const { data, error: resultError } = await supabase
        .from('tenants')
        .select('id, name, slug, owner_name, updated_at, city, business_phone, business_email, address, gstin, upi_id, custom_domain')
        .eq('id', tenantId)
        .maybeSingle()
      if (resultError) setError(resultError.message)
      else if (data) onTenantUpdated(data)
      } else {
      const sortColumn: Record<string, string> = {
        customers: 'full_name',
        technicians: 'full_name',
        inventory_spares: 'name',
        ro_catalog: 'name',
        invoices: 'issued_at',
        whatsapp_messages: 'sent_at',
      }
      const ascending = ['customers', 'technicians', 'inventory_spares', 'ro_catalog'].includes(config.table)
      let request = supabase
        .from(config.table)
        .select(relationSelects[page] ?? '*')
        .eq('tenant_id', tenantId)
        .order(sortColumn[config.table] ?? 'created_at', { ascending })
        .range(pageIndex * pageSize, pageIndex * pageSize + pageSize - 1)

      if (query.trim() && page === 'Customers 360') {
        const safeQuery = query.trim().replace(/[,%()]/g, ' ')
        request = request.or(`full_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`)
      }

      const { data, error: resultError } = await request
      if (resultError) setError(resultError.message)
      else setRows((data ?? []) as unknown as Row[])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Could not load ${config.title.toLowerCase()} data.`)
    } finally {
      setLoading(false)
    }
  }, [config.table, config.title, dashboardSnapshotKey, onTenantUpdated, page, pageIndex, query, reportsSnapshotKey, supabase, tenantId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    const needsCustomerOptions = showJobForm || showWhatsAppForm || createRecordPage === 'AMC Management' || createRecordPage === 'Invoices & Billing'
    if (!supabase || !needsCustomerOptions) return
    let active = true
    const safeSearch = bookingCustomerSearch.trim().replace(/[,%()]/g, ' ')
    let customersQuery = supabase
      .from('customers')
      .select('id, full_name, phone, whatsapp_opt_in')
      .eq('tenant_id', tenantId)
      .order('full_name')
      .limit(50)
    if (safeSearch) customersQuery = customersQuery.ilike('full_name', `%${safeSearch}%`)

    Promise.all([
      customersQuery,
      supabase.from('technicians').select('id, full_name').eq('tenant_id', tenantId).eq('is_active', true).order('full_name').limit(100),
    ]).then(([customersResult, techniciansResult]) => {
      if (!active) return
      if (customersResult.error) setError(customersResult.error.message)
      else setCustomerOptions((customersResult.data ?? []) as unknown as Row[])
      if (techniciansResult.error) setError(techniciansResult.error.message)
      else setTechnicianOptions((techniciansResult.data ?? []) as unknown as Row[])
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load customer and technician options.')
    })

    return () => { active = false }
  }, [bookingCustomerSearch, createRecordPage, showJobForm, showWhatsAppForm, supabase, tenantId])

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !createRecordPage) return
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '').trim()
    let record: Record<string, unknown>

    switch (createRecordPage) {
      case 'AMC Management':
        record = {
          customer_id: text('customer_id'),
          contract_number: `AMC-${crypto.randomUUID()}`,
          tier: text('tier'),
          starts_on: text('starts_on'),
          ends_on: text('ends_on'),
          amount: Number(text('amount')),
        }
        break
      case 'Technicians':
        record = { full_name: text('full_name'), phone: text('phone') || null, area: text('area') || null, pin_code: text('pin_code') || null }
        break
      case 'Inventory Spares':
        record = { sku: text('sku'), name: text('name'), quantity: Number(text('quantity')), minimum_quantity: Number(text('minimum_quantity')), unit_cost: Number(text('unit_cost')), unit: text('unit') || 'pcs' }
        break
      case 'RO Sales & Catalog':
        record = { name: text('name'), category: text('category'), mrp: Number(text('mrp')), dealer_price: Number(text('dealer_price')), stock_quantity: Number(text('stock_quantity')) }
        break
      case 'Invoices & Billing': {
        const subtotal = Number(text('subtotal'))
        const gstAmount = Number(text('gst_amount'))
        record = {
          customer_id: text('customer_id'),
          invoice_number: `INV-${crypto.randomUUID()}`,
          description: text('description'),
          subtotal: subtotal,
          gst_amount: gstAmount,
          total: subtotal + gstAmount,
          status: 'Pending',
        }
        break
      }
      case 'WhatsApp Automation':
        record = { name: text('name'), channel: text('channel'), trigger_type: text('trigger_type'), is_enabled: form.get('is_enabled') === 'on', message_template: text('message_template') || null }
        break
      default:
        return
    }

    setSaving(true)
    const { error: resultError } = await supabase.from(config.table).insert({ tenant_id: tenantId, ...record })
    setSaving(false)
    if (resultError) {
      setError(resultError.message)
      return
    }
    setCreateRecordPage(null)
    setBookingCustomerSearch('')
    onToast(`${pageConfig[createRecordPage].title} record created`)
    invalidateWorkspaceSnapshots(tenantId)
    await loadData(true)
  }

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase()
    const phone = String(form.get('phone') ?? '').trim()
    const { error: resultError } = await supabase.from('customers').insert({
      tenant_id: tenantId,
      customer_code: `CUS-${suffix}`,
      full_name: String(form.get('full_name') ?? '').trim(),
      phone,
      whatsapp_phone_e164: toWhatsAppE164(phone),
      email: String(form.get('email') ?? '').trim() || null,
      area: String(form.get('area') ?? '').trim() || null,
      city: String(form.get('city') ?? '').trim() || null,
      address: String(form.get('address') ?? '').trim() || null,
      whatsapp_opt_in: form.get('whatsapp_opt_in') === 'on',
    })
    if (resultError) {
      setError(resultError.message)
      return
    }
    setShowCustomerForm(false)
    onToast('Customer created')
    invalidateWorkspaceSnapshots(tenantId)
    await loadData(true)
  }

  async function updateCustomerWhatsAppOptIn(id: string, optedIn: boolean) {
    if (!supabase || !canManage) return
    setSaving(true)
    const { error: resultError } = await supabase
      .from('customers')
      .update({ whatsapp_opt_in: optedIn, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', id)
    setSaving(false)
    if (resultError) {
      setError(resultError.message)
      return
    }
    onToast(optedIn ? 'WhatsApp opt-in recorded' : 'WhatsApp opt-in removed')
    await loadData()
  }

  async function bookJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const scheduledAt = new Date(String(form.get('scheduled_at') ?? '')).toISOString()
    const { error: resultError } = await supabase.from('service_jobs').insert({
      tenant_id: tenantId,
      customer_id: String(form.get('customer_id') ?? ''),
      job_number: `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      service_type: String(form.get('service_type') ?? ''),
      scheduled_at: scheduledAt,
      technician_id: String(form.get('technician_id') ?? '') || null,
      notes: String(form.get('notes') ?? '').trim() || null,
    })
    if (resultError) {
      setError(resultError.message)
      return
    }
    setShowJobForm(false)
    onToast('Service job scheduled')
    invalidateWorkspaceSnapshots(tenantId)
    await loadData(true)
  }

  async function updateJobStatus(id: string, status: string) {
    if (!supabase) return
    const { error: resultError } = await supabase
      .from('service_jobs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', id)
    if (resultError) setError(resultError.message)
    else {
      onToast('Job status updated')
      invalidateWorkspaceSnapshots(tenantId)
      await loadData(true)
    }
  }

  async function sendWhatsAppMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const customerId = String(form.get('customer_id') ?? '')
    const message = String(form.get('message') ?? '').trim()
    setWhatsAppError('')
    setSaving(true)
    try {
      const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw new Error(sessionError.message)
      const accessToken = sessionResult.session?.access_token
      if (!accessToken) throw new Error('Your session expired. Sign in again to send a message.')
      const response = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId, customerId, message }),
      })
      const result = await response.json() as { error?: string; warning?: string }
      if (!response.ok) throw new Error(result.error || 'WhatsApp message could not be sent.')
      setShowWhatsAppForm(false)
      setBookingCustomerSearch('')
      onToast(result.warning || 'WhatsApp message sent')
      await loadData()
    } catch (sendError) {
      setWhatsAppError(sendError instanceof Error ? sendError.message : 'WhatsApp message could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-content data-workspace">
    <div className="page-heading"><div><div className="eyebrow">{tenant.name}</div><h1>{config.title}</h1><p>{config.description}</p></div>
      <div className="heading-action">
        {page === 'Customers 360' && canManage && <button className="button primary" onClick={() => setShowCustomerForm(true)}><Plus size={15} /> Add customer</button>}
        {page === 'Dashboard' && canManage && <>
          <button className="button" onClick={() => setShowCustomerForm(true)}><Plus size={15} /> Add customer</button>
          <button className="button primary" onClick={() => setShowJobForm(true)}><CalendarDays size={15} /> Book service</button>
        </>}
        {page === 'WhatsApp Inbox' && canManage && <button className="button primary" onClick={() => { setWhatsAppError(''); setShowWhatsAppForm(true) }}><MessageCircle size={15} /> Send WhatsApp</button>}
        {['Services & Jobs', 'SERVICE STATUS', 'Service Calendar'].includes(page) && canManage && <button className="button primary" onClick={() => setShowJobForm(true)}><CalendarDays size={15} /> Book service</button>}
        {['AMC Management', 'Technicians', 'Inventory Spares', 'RO Sales & Catalog', 'WhatsApp Automation'].includes(page) && canManage && <button className="button primary" onClick={() => setCreateRecordPage(page)}><Plus size={15} /> Add record</button>}
        {page === 'Invoices & Billing' && (canManage || role === 'accountant') && <button className="button primary" onClick={() => setCreateRecordPage(page)}><Plus size={15} /> Create invoice</button>}
        <button className="button" onClick={() => void loadData(true)} aria-label="Refresh data"><RefreshCw size={14} /></button>
      </div>
    </div>

    {page === 'Dashboard' && <DashboardHome summary={summary} loading={loading} error={error} onNavigate={onNavigate} />}
    {page === 'Business Reports' && <ReportsDashboard data={reportData} loading={loading} error={error} theme={theme} />}
    {page === 'Business Settings' && <SettingsCard key={tenant.updated_at} tenant={tenant} role={role} onToast={onToast} onTenantUpdated={onTenantUpdated} />}

    {config.table && <section className="panel data-panel">
      <div className="data-toolbar">
        <div className="data-result-count">{config.table.replaceAll('_', ' ')}</div>
        {page === 'Customers 360' && <label className="search-box"><Search size={15} /><input placeholder="Search name or phone" value={query} onChange={(event) => { setPageIndex(0); setQuery(event.target.value) }} /></label>}
        <span className="data-page-label">{pageIndex * pageSize + 1}–{pageIndex * pageSize + rows.length}</span>
      </div>
      {error && <div className="data-error" role="alert">{error}</div>}
      {loading ? <div className="empty-state">Loading workspace data…</div> : rows.length === 0 ? <div className="empty-state">No {config.title.toLowerCase()} found. Records you add will appear here.</div> : <div className="table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}{['Services & Jobs', 'SERVICE STATUS', 'Service Calendar'].includes(page) && <th>Update status</th>}</tr></thead><tbody>
        {rows.map((row) => <tr key={String(row.id)}>{config.columns.map((column) => <td key={column}>{column === 'whatsapp_opt_in' && canManage ? <button type="button" className={`consent-toggle ${row.whatsapp_opt_in === true ? 'enabled' : ''}`} title="Only mark this if the customer explicitly agreed to receive WhatsApp messages." disabled={saving} onClick={() => void updateCustomerWhatsAppOptIn(String(row.id), row.whatsapp_opt_in !== true)}>{valueFor(row, column)}</button> : valueFor(row, column)}</td>)}{['Services & Jobs', 'SERVICE STATUS', 'Service Calendar'].includes(page) && <td>{canUpdateJobs ? <select value={String(row.status)} onChange={(event) => void updateJobStatus(String(row.id), event.target.value)}><option>Scheduled</option><option>Technician En Route</option><option>In Progress</option><option>Completed</option><option>Cancelled</option></select> : valueFor(row, 'status')}</td>}</tr>)}
      </tbody></table></div>}
      <div className="table-footer"><span>Page {pageIndex + 1} · Maximum {pageSize} rows per page</span><div><button className="icon-button" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={15} /></button><button className="icon-button" disabled={rows.length < pageSize} onClick={() => setPageIndex((value) => value + 1)}><ChevronRight size={15} /></button></div></div>
    </section>}

    {showCustomerForm && <Modal title="Add customer" onClose={() => setShowCustomerForm(false)}><form className="modal-form" onSubmit={addCustomer}><div className="form-grid">
      <label className="field-label">CUSTOMER NAME<input name="full_name" required maxLength={160} /></label><label className="field-label">PHONE<input name="phone" required maxLength={32} /></label>
      <label className="field-label">EMAIL<input name="email" type="email" maxLength={254} /></label><label className="field-label">AREA<input name="area" maxLength={120} /></label>
      <label className="field-label">CITY<input name="city" maxLength={120} /></label><label className="field-label">ADDRESS<input name="address" maxLength={500} /></label>
      <label className="consent-field span-two"><input name="whatsapp_opt_in" type="checkbox" /><span>Customer has explicitly opted in to WhatsApp messages.</span></label>
    </div><div className="modal-actions"><button type="button" className="button" onClick={() => setShowCustomerForm(false)}>Cancel</button><button className="button primary">Save customer</button></div></form></Modal>}
    {showJobForm && <Modal title="Book a service" onClose={() => setShowJobForm(false)}><form className="modal-form" onSubmit={bookJob}><div className="form-grid">
      <label className="field-label span-two">FIND CUSTOMER<input value={bookingCustomerSearch} onChange={(event) => setBookingCustomerSearch(event.target.value)} placeholder="Search customer name" /></label>
      <label className="field-label span-two">CUSTOMER<select name="customer_id" required defaultValue=""><option value="" disabled>Select customer</option>{customerOptions.map((customer) => <option value={String(customer.id)} key={String(customer.id)}>{String(customer.full_name)}</option>)}</select></label>
      <label className="field-label span-two">TECHNICIAN<select name="technician_id" defaultValue=""><option value="">Unassigned</option>{technicianOptions.map((technician) => <option value={String(technician.id)} key={String(technician.id)}>{String(technician.full_name)}</option>)}</select></label>
      <label className="field-label">SERVICE TYPE<select name="service_type"><option>Routine Filter Change</option><option>AMC Visit</option><option>Breakdown Repair</option><option>Installation</option></select></label><label className="field-label">SCHEDULED DATE &amp; TIME<input name="scheduled_at" type="datetime-local" required /></label>
      <label className="field-label span-two">NOTES<textarea name="notes" maxLength={2000} /></label>
    </div><div className="modal-actions"><button type="button" className="button" onClick={() => setShowJobForm(false)}>Cancel</button><button className="button primary">Schedule service</button></div></form></Modal>}
    {showWhatsAppForm && <Modal title="Send WhatsApp message" onClose={() => setShowWhatsAppForm(false)}><form className="modal-form" onSubmit={sendWhatsAppMessage}>
      <div className="form-grid">
        <label className="field-label span-two">FIND OPTED-IN CUSTOMER<input value={bookingCustomerSearch} onChange={(event) => setBookingCustomerSearch(event.target.value)} placeholder="Search customer name" /></label>
        <label className="field-label span-two">CUSTOMER<select name="customer_id" required defaultValue=""><option value="" disabled>Select an opted-in customer</option>{customerOptions.filter((customer) => customer.whatsapp_opt_in === true).map((customer) => <option value={String(customer.id)} key={String(customer.id)}>{String(customer.full_name)} · {String(customer.phone)}</option>)}</select></label>
        <label className="field-label span-two">MESSAGE<textarea name="message" required maxLength={4096} rows={5} placeholder="Write a message for this customer" /></label>
      </div>
      <p className="whatsapp-policy-note">Messages are sent one at a time and only within 24 hours of the customer messaging your WhatsApp number. Record opt-in only after the customer agrees.</p>
      {whatsAppError && <p className="form-error" role="alert">{whatsAppError}</p>}
      <div className="modal-actions"><button type="button" className="button" onClick={() => setShowWhatsAppForm(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Sending…' : 'Send message'}</button></div>
    </form></Modal>}
    {createRecordPage && <Modal title={`Add ${pageConfig[createRecordPage].title.toLowerCase()}`} onClose={() => setCreateRecordPage(null)}><form className="modal-form" onSubmit={addRecord}>
      <div className="form-grid">
        {createRecordPage === 'AMC Management' && <>
          <label className="field-label span-two">FIND CUSTOMER<input value={bookingCustomerSearch} onChange={(event) => setBookingCustomerSearch(event.target.value)} placeholder="Search customer name" /></label>
          <label className="field-label span-two">CUSTOMER<select name="customer_id" required defaultValue=""><option value="" disabled>Select customer</option>{customerOptions.map((customer) => <option value={String(customer.id)} key={String(customer.id)}>{String(customer.full_name)}</option>)}</select></label>
          <label className="field-label">PLAN<select name="tier"><option>Basic</option><option>Comprehensive</option><option>Gold</option></select></label>
          <label className="field-label">AMOUNT<input name="amount" type="number" min="0" step="0.01" required /></label>
          <label className="field-label">START DATE<input name="starts_on" type="date" required /></label><label className="field-label">END DATE<input name="ends_on" type="date" required /></label>
        </>}
        {createRecordPage === 'Technicians' && <>
          <label className="field-label">NAME<input name="full_name" required maxLength={160} /></label><label className="field-label">PHONE<input name="phone" maxLength={32} /></label>
          <label className="field-label">AREA<input name="area" maxLength={120} /></label><label className="field-label">PIN CODE<input name="pin_code" maxLength={12} /></label>
        </>}
        {createRecordPage === 'Inventory Spares' && <>
          <label className="field-label">SKU<input name="sku" required maxLength={80} /></label><label className="field-label">PART NAME<input name="name" required maxLength={160} /></label>
          <label className="field-label">QUANTITY<input name="quantity" type="number" min="0" step="1" defaultValue="0" required /></label><label className="field-label">MINIMUM LEVEL<input name="minimum_quantity" type="number" min="0" step="1" defaultValue="0" required /></label>
          <label className="field-label">UNIT COST<input name="unit_cost" type="number" min="0" step="0.01" defaultValue="0" required /></label><label className="field-label">UNIT<input name="unit" defaultValue="pcs" maxLength={20} /></label>
        </>}
        {createRecordPage === 'RO Sales & Catalog' && <>
          <label className="field-label">PRODUCT NAME<input name="name" required maxLength={160} /></label><label className="field-label">CATEGORY<input name="category" required maxLength={120} /></label>
          <label className="field-label">MRP<input name="mrp" type="number" min="0" step="0.01" defaultValue="0" required /></label><label className="field-label">DEALER PRICE<input name="dealer_price" type="number" min="0" step="0.01" defaultValue="0" required /></label>
          <label className="field-label">STOCK<input name="stock_quantity" type="number" min="0" step="1" defaultValue="0" required /></label>
        </>}
        {createRecordPage === 'Invoices & Billing' && <>
          <label className="field-label span-two">FIND CUSTOMER<input value={bookingCustomerSearch} onChange={(event) => setBookingCustomerSearch(event.target.value)} placeholder="Search customer name" /></label>
          <label className="field-label span-two">CUSTOMER<select name="customer_id" required defaultValue=""><option value="" disabled>Select customer</option>{customerOptions.map((customer) => <option value={String(customer.id)} key={String(customer.id)}>{String(customer.full_name)}</option>)}</select></label>
          <label className="field-label span-two">DESCRIPTION<input name="description" required maxLength={500} /></label>
          <label className="field-label">SUBTOTAL<input name="subtotal" type="number" min="0" step="0.01" defaultValue="0" required /></label><label className="field-label">GST AMOUNT<input name="gst_amount" type="number" min="0" step="0.01" defaultValue="0" required /></label>
        </>}
        {createRecordPage === 'WhatsApp Automation' && <>
          <label className="field-label">RULE NAME<input name="name" required maxLength={120} /></label><label className="field-label">CHANNEL<select name="channel"><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option><option value="in_app">In-app</option></select></label>
          <label className="field-label span-two">TRIGGER<input name="trigger_type" required maxLength={120} placeholder="e.g. amc_expiring" /></label>
          <label className="field-label span-two">MESSAGE TEMPLATE<textarea name="message_template" maxLength={4000} /></label><label className="field-label"><span>ENABLE RULE</span><input name="is_enabled" type="checkbox" /></label>
        </>}
      </div>
      <div className="modal-actions"><button type="button" className="button" onClick={() => setCreateRecordPage(null)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
    </form></Modal>}
  </div>
}

function reportMonthKey(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 7)
}

function buildReportSeries(data: ReportData, metric: ReportMetric, period: number) {
  if (metric === 'job-status') {
    const statuses = ['Scheduled', 'Technician En Route', 'In Progress', 'Completed', 'Cancelled']
    const counts = new Map(statuses.map((status) => [status, 0]))
    data.jobs.forEach((job) => counts.set(job.status, (counts.get(job.status) ?? 0) + 1))
    return {
      label: 'Service jobs by status',
      description: 'Jobs scheduled in the selected period',
      categories: statuses,
      values: statuses.map((status) => counts.get(status) ?? 0),
      valueKind: 'count' as const,
      observationCount: data.jobs.length,
    }
  }

  const now = new Date()
  const months = Array.from({ length: period }, (_, index) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - period + index + 1, 1)))
  const categories = months.map((month) => month.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }))
  const monthIndices = new Map(months.map((month, index) => [month.toISOString().slice(0, 7), index]))
  const values = Array(period).fill(0) as number[]
  let observationCount = 0
  let valueKind: 'count' | 'currency' = 'count'
  let label = ''
  let description = ''

  if (metric === 'customers') {
    label = 'New customers'
    description = 'Customer records created each month'
    data.customers.forEach((customer) => {
      const index = monthIndices.get(reportMonthKey(customer.created_at))
      if (index !== undefined) {
        values[index] += 1
        observationCount += 1
      }
    })
  } else if (metric === 'jobs') {
    label = 'Service jobs'
    description = 'Jobs scheduled each month'
    data.jobs.forEach((job) => {
      const index = monthIndices.get(reportMonthKey(job.scheduled_at))
      if (index !== undefined) {
        values[index] += 1
        observationCount += 1
      }
    })
  } else if (metric === 'contracts') {
    label = 'AMC contracts ending'
    description = 'Contracts reaching their end date each month'
    data.contracts.forEach((contract) => {
      const index = monthIndices.get(reportMonthKey(contract.ends_on))
      if (index !== undefined) {
        values[index] += 1
        observationCount += 1
      }
    })
  } else {
    label = 'Paid revenue'
    description = 'Total paid invoice value by payment month'
    valueKind = 'currency'
    data.invoices.forEach((invoice) => {
      const index = monthIndices.get(reportMonthKey(invoice.paid_at))
      if (index !== undefined) {
        values[index] += invoice.total
        observationCount += 1
      }
    })
  }

  return { label, description, categories, values, valueKind, observationCount }
}

function ReportsDashboard({ data, loading, error, theme }: { data: ReportData | null; loading: boolean; error: string; theme: 'light' | 'dark' }) {
  const [metric, setMetric] = useState<ReportMetric>('customers')
  const [chartType, setChartType] = useState<ReportChartType>('bar')
  const [period, setPeriod] = useState(12)
  const series = useMemo(() => data ? buildReportSeries(data, metric, period) : null, [data, metric, period])
  const total = series?.values.reduce((sum, value) => sum + value, 0) ?? 0

  return <section className="panel report-builder">
    <div className="report-builder-header">
      <div><h2>Explore your business</h2><p>Choose a metric, time range, and chart style.</p></div>
      <div className="report-controls">
        <label className="field-label">METRIC<select value={metric} onChange={(event) => setMetric(event.target.value as ReportMetric)}>
          <option value="customers">New customers</option>
          <option value="jobs">Service jobs by month</option>
          <option value="job-status">Service jobs by status</option>
          <option value="contracts">AMC contracts ending</option>
          <option value="revenue">Paid revenue</option>
        </select></label>
        <label className="field-label">CHART TYPE<select value={chartType} onChange={(event) => setChartType(event.target.value as ReportChartType)}>
          <option value="bar">2D · Bar</option>
          <option value="line">2D · Line</option>
          <option value="pie">2D · Pie</option>
          <option value="donut">2D · Donut</option>
          <option value="pie3d">3D · Pie</option>
          <option value="bar3d">3D · Bar graph</option>
          <option value="line3d">3D · Trend</option>
        </select></label>
        <label className="field-label">RANGE<select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select></label>
      </div>
    </div>
    {error ? <div className="data-error" role="alert">Reports could not be loaded: {error}</div>
      : loading || !series ? <div className="report-empty">Loading report data…</div>
        : series.observationCount === 0 ? <div className="report-empty"><strong>No activity in this range yet</strong><span>Try another metric or time range as your workspace grows.</span></div>
          : <div className="report-visualization">
            <div className="report-chart-heading"><div><h3>{series.label}</h3><p>{series.description}</p></div><strong>{series.valueKind === 'currency' ? money(total) : total.toLocaleString('en-IN')}<small>{series.valueKind === 'currency' ? 'total paid' : 'total records'}</small></strong></div>
            <ReportChart categories={series.categories} values={series.values} chartType={chartType} valueKind={series.valueKind} theme={theme} />
            <ul className="sr-only">{series.categories.map((category, index) => <li key={category}>{category}: {series.valueKind === 'currency' ? money(series.values[index]) : series.values[index]}</li>)}</ul>
          </div>}
  </section>
}

function DashboardHome({
  summary,
  loading,
  error,
  onNavigate,
}: {
  summary: DashboardSummary | null
  loading: boolean
  error: string
  onNavigate: (page: ViewKey) => void
}) {
  const count = (value: number | undefined) => loading ? '…' : error ? '—' : String(value ?? 0)
  const amount = (value: number | undefined) => loading ? '…' : error ? '—' : money(value ?? 0)
  const overdue = summary?.overdue_jobs ?? 0

  const cards = [
    { label: 'Customers', value: summary?.customer_count, note: 'In your workspace', icon: Users, tone: 'blue' },
    { label: 'Active contracts', value: summary?.active_contract_count, note: `${count(summary?.expiring_contract_count)} expiring in 30 days`, icon: ShieldCheck, tone: 'green' },
    { label: 'Services today', value: summary?.jobs_today, note: 'Scheduled field visits', icon: Wrench, tone: 'violet' },
    { label: 'Overdue jobs', value: summary?.overdue_jobs, note: overdue > 0 ? 'Follow-up needed' : 'No overdue visits', icon: AlertTriangle, tone: overdue > 0 ? 'amber' : 'green' },
  ]

  return <div className="dashboard-home">
    {error && <div className="data-error" role="alert">Dashboard data could not be loaded: {error}</div>}
    <div className="dashboard-kpis">
      {cards.map(({ label, value, note, icon: Icon, tone }) => <section className="panel dashboard-kpi" key={label}>
        <div className="dashboard-kpi-top"><span>{label}</span><span className={`dashboard-kpi-icon ${tone}`}><Icon size={18} /></span></div>
        <strong>{count(value)}</strong>
        <small>{note}</small>
      </section>)}
    </div>
    <div className="dashboard-overview-grid">
      <section className="panel dashboard-overview-card">
        <div className="dashboard-overview-heading"><span className="dashboard-overview-icon blue"><CalendarDays size={17} /></span><div><h2>Service workload</h2><p>Today at a glance</p></div></div>
        <div className="dashboard-overview-rows">
          <div><span>Scheduled today</span><strong>{count(summary?.jobs_today)}</strong></div>
          <div><span>Overdue follow-ups</span><strong className={overdue > 0 ? 'attention' : ''}>{count(summary?.overdue_jobs)}</strong></div>
        </div>
        <button className="dashboard-card-link" onClick={() => onNavigate('Services & Jobs')}>Open service jobs <ArrowRight size={14} /></button>
      </section>
      <section className="panel dashboard-overview-card">
        <div className="dashboard-overview-heading"><span className="dashboard-overview-icon green"><ShieldCheck size={17} /></span><div><h2>AMC renewals</h2><p>Keep upcoming renewals in view</p></div></div>
        <div className="dashboard-overview-rows">
          <div><span>Active contracts</span><strong>{count(summary?.active_contract_count)}</strong></div>
          <div><span>Expiring in 30 days</span><strong>{count(summary?.expiring_contract_count)}</strong></div>
        </div>
        <button className="dashboard-card-link" onClick={() => onNavigate('AMC Management')}>Manage contracts <ArrowRight size={14} /></button>
      </section>
      <section className="panel dashboard-overview-card">
        <div className="dashboard-overview-heading"><span className="dashboard-overview-icon violet"><CircleDollarSign size={17} /></span><div><h2>Financial snapshot</h2><p>Current month and outstanding</p></div></div>
        <div className="dashboard-overview-rows">
          <div><span>Revenue this month</span><strong>{amount(summary?.revenue_this_month)}</strong></div>
          <div><span>Unpaid invoices</span><strong>{amount(summary?.pending_invoice_amount)}</strong></div>
        </div>
        <button className="dashboard-card-link" onClick={() => onNavigate('Invoices & Billing')}>View invoices <ArrowRight size={14} /></button>
      </section>
    </div>
  </div>
}

function SettingsCard({
  tenant,
  role,
  onToast,
  onTenantUpdated,
}: {
  tenant: TenantProfile
  role: string | undefined
  onToast: Props['onToast']
  onTenantUpdated: Props['onTenantUpdated']
}) {
  const supabase = getSupabaseClient()
  const canManage = role === 'owner' || role === 'admin' || role === 'manager'
  const [profile, setProfile] = useState({
    name: tenant.name,
    owner_name: tenant.owner_name,
    business_phone: tenant.business_phone ?? '',
    business_email: tenant.business_email ?? '',
    address: tenant.address ?? '',
    city: tenant.city ?? '',
    gstin: tenant.gstin ?? '',
    upi_id: tenant.upi_id ?? '',
    custom_domain: tenant.custom_domain ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateField(field: keyof typeof profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !canManage) return
    setSaving(true)
    setError('')
    const updates = {
      name: profile.name.trim(),
      owner_name: profile.owner_name.trim(),
      business_phone: profile.business_phone.trim() || null,
      business_email: profile.business_email.trim() || null,
      address: profile.address.trim() || null,
      city: profile.city.trim(),
      gstin: profile.gstin.trim() || null,
      upi_id: profile.upi_id.trim() || null,
      custom_domain: profile.custom_domain.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { data, error: saveError } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenant.id)
      .select('id, name, slug, owner_name, updated_at, city, business_phone, business_email, address, gstin, upi_id, custom_domain')
      .maybeSingle()
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    if (!data) {
      setError('No workspace was updated. Check that you have permission to edit these details.')
      return
    }
    onTenantUpdated(data)
    onToast('Business details saved')
  }

  return <section className="panel settings-panel settings-editor">
    <div className="settings-editor-heading"><div><h2>Business profile</h2><p>These details identify your business in AMC Desk.</p></div></div>
    <div className="workspace-url"><strong>COMPANY WORKSPACE URL</strong><a href={`https://${tenant.slug}.amcdesk.com`} target="_blank" rel="noreferrer">{tenant.slug}.amcdesk.com</a></div>
    <form className="settings-form" onSubmit={saveProfile}>
      <div className="settings-fields">
        <label className="field-label">BUSINESS NAME<input required maxLength={160} value={profile.name} onChange={(event) => updateField('name', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label">OWNER / CONTACT PERSON<input required maxLength={160} value={profile.owner_name} onChange={(event) => updateField('owner_name', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label">BUSINESS PHONE<input type="tel" maxLength={32} value={profile.business_phone} onChange={(event) => updateField('business_phone', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label">BUSINESS EMAIL<input type="email" maxLength={254} value={profile.business_email} onChange={(event) => updateField('business_email', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label settings-address">BUSINESS ADDRESS<input maxLength={500} value={profile.address} onChange={(event) => updateField('address', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label">CITY<input maxLength={120} value={profile.city} onChange={(event) => updateField('city', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label">GSTIN<input maxLength={32} value={profile.gstin} onChange={(event) => updateField('gstin', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label">UPI ID<input maxLength={120} value={profile.upi_id} onChange={(event) => updateField('upi_id', event.target.value)} disabled={!canManage} /></label>
        <label className="field-label">WEBSITE / DOMAIN<input maxLength={253} value={profile.custom_domain} onChange={(event) => updateField('custom_domain', event.target.value)} disabled={!canManage} placeholder="example.com" /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!canManage && <p className="settings-permission-note">Only workspace owners, admins, and managers can edit business details.</p>}
      {canManage && <div className="settings-editor-actions"><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save business details'}</button></div>}
    </form>
  </section>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>
}
