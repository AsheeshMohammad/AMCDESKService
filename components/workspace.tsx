'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react'
import { getSupabaseClient, money } from '@/lib/supabase'

export type ViewKey =
  | 'Dashboard' | 'WhatsApp Inbox' | 'WhatsApp Automation' | 'SERVICE STATUS' | 'Customers 360'
  | 'Services & Jobs' | 'Service Calendar' | 'AMC Management' | 'Technicians' | 'Inventory Spares'
  | 'RO Sales & Catalog' | 'Invoices & Billing' | 'Business Reports' | 'Business Settings'

type Props = {
  page: ViewKey
  tenantId: string
  role: string | undefined
  tenant: {
    name: string
    city: string | null
    gstin: string | null
    upi_id: string | null
    custom_domain: string | null
  }
  onToast: (message: string) => void
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

const pageConfig: Record<ViewKey, { table: string; title: string; description: string; columns: string[] }> = {
  Dashboard: { table: '', title: 'Dashboard', description: 'Live operational summary for this workspace.', columns: [] },
  'Customers 360': { table: 'customers', title: 'Customers', description: 'Customer records belonging to this workspace.', columns: ['customer_code', 'full_name', 'phone', 'email', 'area', 'city'] },
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
  if (column.endsWith('_at') && typeof value === 'string') return new Date(value).toLocaleString()
  return String(value)
}

export default function Workspace({ page, tenantId, role, tenant, onToast }: Props) {
  const supabase = getSupabaseClient()
  const config = pageConfig[page]
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [customerOptions, setCustomerOptions] = useState<Row[]>([])
  const [technicianOptions, setTechnicianOptions] = useState<Row[]>([])
  const [bookingCustomerSearch, setBookingCustomerSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showJobForm, setShowJobForm] = useState(false)
  const [createRecordPage, setCreateRecordPage] = useState<ViewKey | null>(null)
  const [saving, setSaving] = useState(false)
  const pageSize = 50
  const canManage = role === 'owner' || role === 'admin' || role === 'manager'
  const canUpdateJobs = canManage || role === 'technician'

  const loadData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    if (page === 'Dashboard' || page === 'Business Reports') {
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
      else setSummary({
        customer_count: customersResult.count ?? 0,
        active_contract_count: activeContractsResult.count ?? 0,
        expiring_contract_count: expiringContractsResult.count ?? 0,
        jobs_today: jobsTodayResult.count ?? 0,
        overdue_jobs: overdueJobsResult.count ?? 0,
        pending_invoice_amount: (unpaidInvoicesResult.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        revenue_this_month: (revenueResult.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
      })
      setRows([])
    } else if (page === 'Business Settings') {
      const { data, error: resultError } = await supabase
        .from('tenants')
        .select('name, slug, city, gstin, upi_id, custom_domain')
        .eq('id', tenantId)
        .maybeSingle()
      if (resultError) setError(resultError.message)
      else setRows(data ? [data as Row] : [])
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

    setLoading(false)
  }, [config.table, page, pageIndex, query, supabase, tenantId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    const needsCustomerOptions = showJobForm || createRecordPage === 'AMC Management' || createRecordPage === 'Invoices & Billing'
    if (!supabase || !needsCustomerOptions) return
    let active = true
    const safeSearch = bookingCustomerSearch.trim().replace(/[,%()]/g, ' ')
    let customersQuery = supabase
      .from('customers')
      .select('id, full_name')
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
    })

    return () => { active = false }
  }, [bookingCustomerSearch, createRecordPage, showJobForm, supabase, tenantId])

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
    await loadData()
  }

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase()
    const { error: resultError } = await supabase.from('customers').insert({
      tenant_id: tenantId,
      customer_code: `CUS-${suffix}`,
      full_name: String(form.get('full_name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim() || null,
      area: String(form.get('area') ?? '').trim() || null,
      city: String(form.get('city') ?? '').trim() || null,
      address: String(form.get('address') ?? '').trim() || null,
    })
    if (resultError) {
      setError(resultError.message)
      return
    }
    setShowCustomerForm(false)
    onToast('Customer created')
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
    await loadData()
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
      await loadData()
    }
  }

  return <div className="page-content data-workspace">
    <div className="page-heading"><div><div className="eyebrow">{tenant.name}</div><h1>{config.title}</h1><p>{config.description}</p></div>
      <div className="heading-action">
        {page === 'Customers 360' && canManage && <button className="button primary" onClick={() => setShowCustomerForm(true)}><Plus size={15} /> Add customer</button>}
        {['Services & Jobs', 'SERVICE STATUS', 'Service Calendar'].includes(page) && canManage && <button className="button primary" onClick={() => setShowJobForm(true)}><CalendarDays size={15} /> Book service</button>}
        {['AMC Management', 'Technicians', 'Inventory Spares', 'RO Sales & Catalog', 'WhatsApp Automation'].includes(page) && canManage && <button className="button primary" onClick={() => setCreateRecordPage(page)}><Plus size={15} /> Add record</button>}
        {page === 'Invoices & Billing' && (canManage || role === 'accountant') && <button className="button primary" onClick={() => setCreateRecordPage(page)}><Plus size={15} /> Create invoice</button>}
        <button className="button" onClick={() => void loadData()} aria-label="Refresh data"><RefreshCw size={14} /></button>
      </div>
    </div>

    {(page === 'Dashboard' || page === 'Business Reports') && <DashboardCards summary={summary} loading={loading} />}
    {page === 'Business Settings' && <SettingsCard tenant={tenant} />}

    {config.table && <section className="panel data-panel">
      <div className="data-toolbar">
        <div className="data-result-count">{config.table.replaceAll('_', ' ')}</div>
        {page === 'Customers 360' && <label className="search-box"><Search size={15} /><input placeholder="Search name or phone" value={query} onChange={(event) => { setPageIndex(0); setQuery(event.target.value) }} /></label>}
        <span className="data-page-label">{pageIndex * pageSize + 1}–{pageIndex * pageSize + rows.length}</span>
      </div>
      {error && <div className="data-error" role="alert">{error}</div>}
      {loading ? <div className="empty-state">Loading workspace data…</div> : rows.length === 0 ? <div className="empty-state">No {config.title.toLowerCase()} found. Records you add will appear here.</div> : <div className="table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}{['Services & Jobs', 'SERVICE STATUS', 'Service Calendar'].includes(page) && <th>Update status</th>}</tr></thead><tbody>
        {rows.map((row) => <tr key={String(row.id)}>{config.columns.map((column) => <td key={column}>{valueFor(row, column)}</td>)}{['Services & Jobs', 'SERVICE STATUS', 'Service Calendar'].includes(page) && <td>{canUpdateJobs ? <select value={String(row.status)} onChange={(event) => void updateJobStatus(String(row.id), event.target.value)}><option>Scheduled</option><option>Technician En Route</option><option>In Progress</option><option>Completed</option><option>Cancelled</option></select> : valueFor(row, 'status')}</td>}</tr>)}
      </tbody></table></div>}
      <div className="table-footer"><span>Page {pageIndex + 1} · Maximum {pageSize} rows per page</span><div><button className="icon-button" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={15} /></button><button className="icon-button" disabled={rows.length < pageSize} onClick={() => setPageIndex((value) => value + 1)}><ChevronRight size={15} /></button></div></div>
    </section>}

    {showCustomerForm && <Modal title="Add customer" onClose={() => setShowCustomerForm(false)}><form className="modal-form" onSubmit={addCustomer}><div className="form-grid">
      <label className="field-label">CUSTOMER NAME<input name="full_name" required maxLength={160} /></label><label className="field-label">PHONE<input name="phone" required maxLength={32} /></label>
      <label className="field-label">EMAIL<input name="email" type="email" maxLength={254} /></label><label className="field-label">AREA<input name="area" maxLength={120} /></label>
      <label className="field-label">CITY<input name="city" maxLength={120} /></label><label className="field-label">ADDRESS<input name="address" maxLength={500} /></label>
    </div><div className="modal-actions"><button type="button" className="button" onClick={() => setShowCustomerForm(false)}>Cancel</button><button className="button primary">Save customer</button></div></form></Modal>}
    {showJobForm && <Modal title="Book a service" onClose={() => setShowJobForm(false)}><form className="modal-form" onSubmit={bookJob}><div className="form-grid">
      <label className="field-label span-two">FIND CUSTOMER<input value={bookingCustomerSearch} onChange={(event) => setBookingCustomerSearch(event.target.value)} placeholder="Search customer name" /></label>
      <label className="field-label span-two">CUSTOMER<select name="customer_id" required defaultValue=""><option value="" disabled>Select customer</option>{customerOptions.map((customer) => <option value={String(customer.id)} key={String(customer.id)}>{String(customer.full_name)}</option>)}</select></label>
      <label className="field-label span-two">TECHNICIAN<select name="technician_id" defaultValue=""><option value="">Unassigned</option>{technicianOptions.map((technician) => <option value={String(technician.id)} key={String(technician.id)}>{String(technician.full_name)}</option>)}</select></label>
      <label className="field-label">SERVICE TYPE<select name="service_type"><option>Routine Filter Change</option><option>AMC Visit</option><option>Breakdown Repair</option><option>Installation</option></select></label><label className="field-label">SCHEDULED DATE &amp; TIME<input name="scheduled_at" type="datetime-local" required /></label>
      <label className="field-label span-two">NOTES<textarea name="notes" maxLength={2000} /></label>
    </div><div className="modal-actions"><button type="button" className="button" onClick={() => setShowJobForm(false)}>Cancel</button><button className="button primary">Schedule service</button></div></form></Modal>}
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

function DashboardCards({ summary, loading }: { summary: DashboardSummary | null; loading: boolean }) {
  const cards = [
    ['Customers', summary?.customer_count],
    ['Active AMC contracts', summary?.active_contract_count],
    ['Contracts expiring soon', summary?.expiring_contract_count],
    ['Jobs today', summary?.jobs_today],
    ['Overdue jobs', summary?.overdue_jobs],
    ['Revenue this month', summary?.revenue_this_month === undefined ? undefined : money(summary.revenue_this_month)],
    ['Unpaid invoices', summary?.pending_invoice_amount === undefined ? undefined : money(summary.pending_invoice_amount)],
  ]
  return <div className="data-stat-grid">{cards.map(([label, value]) => <section className="panel data-stat" key={String(label)}><span>{label}</span><strong>{loading ? '…' : String(value ?? 0)}</strong></section>)}</div>
}

function SettingsCard({ tenant }: { tenant: Props['tenant'] }) {
  return <section className="panel settings-panel data-settings"><h2>Business profile</h2><dl>{Object.entries(tenant).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value || 'Not set'}</dd></div>)}</dl></section>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>
}
