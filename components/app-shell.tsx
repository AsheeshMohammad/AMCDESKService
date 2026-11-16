'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowUpRight, BarChart3, Bell, CalendarDays, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, CreditCard, Droplets, Filter, Gauge, LayoutDashboard, LogOut, Menu, MessageCircle,
  Moon, Package, Plus, Search, Settings, ShieldCheck, ShoppingBag, Sun, Users, Wrench, X,
} from 'lucide-react'
import Workspace, { type ViewKey } from '@/components/workspace'
import { customers, tenants as initialTenants, type Tenant } from '@/lib/data'

const navigation: { name: ViewKey; icon: typeof LayoutDashboard; badge?: string; section?: string }[] = [
  { name: 'Dashboard', icon: LayoutDashboard, section: 'WORKSPACE' },
  { name: 'WhatsApp Inbox', icon: MessageCircle },
  { name: 'WhatsApp Automation', icon: Activity },
  { name: 'SERVICE STATUS', icon: Gauge },
  { name: 'Customers 360', icon: Users, section: 'CUSTOMER MANAGEMENT' },
  { name: 'Services & Jobs', icon: ClipboardList },
  { name: 'Service Calendar', icon: CalendarDays },
  { name: 'AMC Management', icon: ShieldCheck },
  { name: 'Technicians', icon: Wrench, section: 'OPERATIONS' },
  { name: 'Inventory Spares', icon: Package },
  { name: 'RO Sales & Catalog', icon: ShoppingBag, badge: 'NEW' },
  { name: 'Invoices & Billing', icon: CreditCard, section: 'GROW YOUR BUSINESS' },
  { name: 'Business Reports', icon: BarChart3 },
  { name: 'Business Settings', icon: Settings },
]

type Props = { superAdmin?: boolean }

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal"><div className="modal-header"><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>
}

export default function AppShell({ superAdmin = false }: Props) {
  const [page, setPage] = useState<ViewKey>('Dashboard')
  const [tenant, setTenant] = useState<Tenant>(initialTenants[0])
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [dialog, setDialog] = useState<'customer' | 'booking' | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('ro-renewal-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      // Restore the user's appearance preference after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    let tenantList = initialTenants
    const savedTenants = window.localStorage.getItem('ro-renewal-tenants')
    if (savedTenants) {
      try {
        const parsed = JSON.parse(savedTenants) as Tenant[]
        if (Array.isArray(parsed) && parsed.length) {
          tenantList = parsed
          // Load persisted tenant data after hydration to keep server and client markup aligned.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setTenants(parsed)
        }
      } catch {
        window.localStorage.removeItem('ro-renewal-tenants')
      }
    }
    const host = window.location.hostname.toLowerCase()
    const slug = window.location.pathname.split('/').filter(Boolean)[0]
    const match = tenantList.find((item) => item.active && (item.customDomain.toLowerCase() === host || item.slug === slug))
    if (match) setTenant(match)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const searchResults = useMemo(() => query.trim().length < 2 ? [] : customers.filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.serial}`.toLowerCase().includes(query.toLowerCase()),
  ).slice(0, 5), [query])

  const toast = (message: string) => setNotice(message)
  const toggleTheme = () => setTheme((current) => {
    const next = current === 'light' ? 'dark' : 'light'
    window.localStorage.setItem('ro-renewal-theme', next)
    return next
  })

  if (superAdmin) return <div data-theme={theme}><button className="theme-toggle admin-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><SuperAdmin tenants={tenants} setTenants={(next) => {
    setTenants(next)
    window.localStorage.setItem('ro-renewal-tenants', JSON.stringify(next))
  }} /></div>

  return <div className="app-shell" data-theme={theme}>
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
      <div className="brand-row"><div className="brand-symbol"><Droplets size={18} fill="currentColor" /></div><div className="brand-name">RO Renewal <span>PRO</span></div><button className="mobile-close icon-button" onClick={() => setSidebarOpen(false)}><X size={17} /></button></div>
      <div className="brand-tagline">Never miss a service.<br />Never lose a customer.</div>
      <div className="workspace-picker"><div className="workspace-logo">SR</div><div className="workspace-copy"><strong>{tenant.name}</strong><span>Owner: {tenant.owner}</span></div><span className="online-dot" /><button className="workspace-menu" onClick={() => setTenant(tenants[(tenants.findIndex((item) => item.id === tenant.id) + 1) % tenants.length])} aria-label="Switch workspace"><ChevronDown size={14} /></button><div className="workspace-switch-hint">Switch workspace</div></div>
      <nav className="sidebar-nav">{navigation.map((item, index) => {
        const previousSection = navigation[index - 1]?.section
        const Icon = item.icon
        return <div key={item.name}>{item.section && <div className="nav-section">{item.section}</div>}<button className={`nav-item ${page === item.name ? 'active' : ''}`} onClick={() => { setPage(item.name); setSidebarOpen(false) }}><Icon size={17} strokeWidth={1.8} /><span>{item.name}</span>{item.badge && <i className="new-badge">{item.badge}</i>}{item.name === 'WhatsApp Inbox' && <span className="nav-count">4</span>}</button>{previousSection && !item.section && null}</div>
      })}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={16} /></div><span><strong>Need a hand?</strong><small>Visit our help center</small></span><ChevronRight size={14} /></div><button className="logout-sidebar" onClick={() => toast('You are safely logged out of the demo')}><LogOut size={16} /> Log Out</button><div className="sidebar-footer"><span>RO Renewal PRO</span><span>v1.0.0 · Demo workspace</span></div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{page}</strong></div></div><div className="topbar-tools"><div className="global-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false) }} placeholder="Search phone, customer..." /><kbd>⌘ K</kbd>{searchOpen && query.length >= 2 && <div className="search-results">{searchResults.length ? searchResults.map((customer) => <button key={customer.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setPage('Customers 360'); setSearchOpen(false); setQuery(''); toast(`Opened ${customer.name}'s profile`) }}><span className="search-avatar">{customer.avatar}</span><span><strong>{customer.name}</strong><small>{customer.phone} · {customer.serial}</small></span><ArrowUpRight size={14} /></button>) : <div className="search-empty">No customers found</div>}</div>}</div><div className="sync-pill"><span className="online-dot" /> <span>Cloud Synced</span></div><button className="button header-book" aria-label="Book Service" onClick={() => setDialog('booking')}><CalendarDays size={14} /> Book Service</button><button className="button primary header-add" onClick={() => setDialog('customer')}><Plus size={15} /> Add Customer</button><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="notification-button" aria-label="Notifications" onClick={() => toast('You are all caught up')}><Bell size={17} /><i /></button><div className="profile-chip"><span className="profile-avatar">A</span><span>Owner</span><ChevronDown size={13} /></div><button className="header-logout" onClick={() => toast('You are safely logged out of the demo')} aria-label="Log out"><LogOut size={16} /></button></div></header>
      <div className="workspace"><Workspace page={page} tenant={tenant} onNavigate={setPage} onToast={toast} onBook={() => setDialog('booking')} onSelectCustomer={() => {}} /></div>
      <footer className="app-footer"><span>© {new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date())} RO Renewal PRO</span><span><i className="online-dot" /> All systems operational</span><a href="/super-admin">Platform admin <ArrowUpRight size={12} /></a></footer>
    </main>
    {dialog === 'customer' && <Modal title="Add a customer" onClose={() => setDialog(null)}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); setDialog(null); toast('Customer added to your workspace') }}><p className="modal-copy">Create a customer profile to start tracking their RO and service history.</p><div className="form-grid"><label className="field-label">CUSTOMER NAME<input required placeholder="e.g. Ananya Reddy" /></label><label className="field-label">PHONE NUMBER<input required type="tel" placeholder="+91 98XXX XXXXX" /></label><label className="field-label">AREA / LOCALITY<input placeholder="e.g. Madhapur" /></label><label className="field-label">PURIFIER MODEL<input placeholder="e.g. Kent Grand Plus" /></label></div><div className="modal-actions"><button type="button" className="button" onClick={() => setDialog(null)}>Cancel</button><button className="button primary"><Plus size={14} /> Add customer</button></div></form></Modal>}
    {dialog === 'booking' && <Modal title="Book a service" onClose={() => setDialog(null)}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); setDialog(null); toast('Service visit scheduled successfully') }}><p className="modal-copy">Schedule a doorstep visit for a customer.</p><div className="form-grid"><label className="field-label">CUSTOMER<select required defaultValue=""><option value="" disabled>Select customer</option>{customers.map((customer) => <option key={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label><label className="field-label">SERVICE TYPE<select><option>Routine Filter Change</option><option>AMC Visit</option><option>Breakdown Repair</option><option>Installation</option></select></label><label className="field-label">DATE<input required type="date" defaultValue="2025-11-17" /></label><label className="field-label">PREFERRED TIME<select><option>09:30 AM</option><option>11:30 AM</option><option>02:00 PM</option><option>04:00 PM</option></select></label><label className="field-label span-two">ASSIGN TECHNICIAN<select>{['Ramesh Kumar', 'Sajid Ali', 'Naveen Reddy', 'Mahesh Babu', 'Imran Khan'].map((name) => <option key={name}>{name}</option>)}</select></label></div><div className="modal-actions"><button type="button" className="button" onClick={() => setDialog(null)}>Cancel</button><button className="button primary"><CalendarDays size={14} /> Schedule visit</button></div></form></Modal>}
    {notice && <div className="toast"><span><Check size={14} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
  </div>
}

function SuperAdmin({ tenants, setTenants }: { tenants: Tenant[]; setTenants: (tenants: Tenant[]) => void }) {
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [draft, setDraft] = useState({ name: '', owner: '', city: '', customDomain: '', slug: '', gstin: '', upi: '' })
  const [notice, setNotice] = useState('')
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const next = editing
      ? tenants.map((tenant) => tenant.id === editing.id ? { ...tenant, ...draft } : tenant)
      : [...tenants, { ...draft, id: `dealer-${Date.now()}`, active: true }]
    setTenants(next)
    setForm(false)
    setEditing(null)
    setNotice(editing ? 'Dealer workspace updated' : 'New dealer workspace created')
    window.setTimeout(() => setNotice(''), 2500)
  }
  const startEdit = (tenant: Tenant) => {
    setEditing(tenant)
    setDraft({ name: tenant.name, owner: tenant.owner, city: tenant.city, customDomain: tenant.customDomain, slug: tenant.slug, gstin: tenant.gstin, upi: tenant.upi })
    setForm(true)
  }
  return <div className="admin-shell"><aside className="admin-sidebar"><Link className="brand-row" href="/"><div className="brand-symbol"><Droplets size={18} fill="currentColor" /></div><div className="brand-name">RO Renewal <span>PRO</span></div></Link><div className="admin-label">PLATFORM</div><Link className="admin-nav active" href="/super-admin"><LayoutDashboard size={16} /> Dealer workspaces</Link><Link className="admin-nav" href="/"><Gauge size={16} /> Back to product</Link><div className="admin-sidebar-bottom"><ShieldCheck size={17} /> Super administrator</div></aside><main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow">PLATFORM CONTROL CENTER</span><h1>Dealer workspaces</h1></div><div className="profile-chip"><span className="profile-avatar">S</span> Super Admin</div></header><div className="admin-content"><div className="admin-intro"><div><h2>Manage your tenants</h2><p>Provision branded RO Renewal workspaces and connect each dealer&apos;s custom domain.</p></div><button className="button primary" onClick={() => { setEditing(null); setDraft({ name: '', owner: '', city: '', customDomain: '', slug: '', gstin: '', upi: '' }); setForm(true) }}><Plus size={15} /> Add dealer</button></div><div className="admin-kpis"><div className="panel"><span>ACTIVE DEALERS</span><strong>{tenants.filter((tenant) => tenant.active).length}</strong><small>of {tenants.length} total</small></div><div className="panel"><span>CUSTOM DOMAINS</span><strong>{tenants.filter((tenant) => tenant.customDomain).length}</strong><small>Domains connected</small></div><div className="panel"><span>PLATFORM LIMIT</span><strong>10+</strong><small>Dealer workspaces</small></div></div><section className="panel admin-table-panel"><div className="panel-title-row"><div><h3>All workspaces</h3><p>Changes apply to this local demo and persist in your browser.</p></div><button className="button"><Filter size={14} /> All status</button></div><div className="table-scroll"><table><thead><tr><th>BUSINESS</th><th>OWNER &amp; CITY</th><th>CUSTOM DOMAIN</th><th>URL PATH</th><th>STATUS</th><th></th></tr></thead><tbody>{tenants.map((tenant) => <tr key={tenant.id}><td><div className="customer-cell"><div className="workspace-logo">{tenant.name.slice(0, 2)}</div><span><strong>{tenant.name}</strong><small>GSTIN · {tenant.gstin}</small></span></div></td><td><strong>{tenant.owner}</strong><small>{tenant.city}</small></td><td><span className="domain-label">{tenant.customDomain}</span></td><td className="mono">/{tenant.slug}</td><td><button className={`toggle ${tenant.active ? 'on' : ''}`} aria-label="Toggle tenant active status" onClick={() => setTenants(tenants.map((item) => item.id === tenant.id ? { ...item, active: !item.active } : item))}><span /></button> <Badge tone={tenant.active ? 'green' : 'slate'}>{tenant.active ? 'Active' : 'Inactive'}</Badge></td><td><button className="text-button" onClick={() => startEdit(tenant)}>Edit <ArrowUpRight size={13} /></button></td></tr>)}</tbody></table></div></section><div className="admin-footnote"><ShieldCheck size={15} /> Multi-tenant routing is configured with custom domain and URL slug detection. Supabase integration can be enabled when ready.</div></div></main>{form && <Modal title={editing ? 'Edit dealer workspace' : 'Add dealer workspace'} onClose={() => setForm(false)}><form className="modal-form" onSubmit={save}><p className="modal-copy">Set up this dealer&apos;s branded workspace and billing identity.</p><div className="form-grid"><label className="field-label">BUSINESS NAME<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Aqua Care Services" /></label><label className="field-label">OWNER NAME<input required value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder="Dealer owner" /></label><label className="field-label">CITY<input required value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Hyderabad" /></label><label className="field-label">CUSTOM DOMAIN<input value={draft.customDomain} onChange={(e) => setDraft({ ...draft, customDomain: e.target.value })} placeholder="dealer.in" /></label><label className="field-label">URL PATH SLUG<input required value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replaceAll(' ', '-') })} placeholder="dealer-name" /></label><label className="field-label">GSTIN<input value={draft.gstin} onChange={(e) => setDraft({ ...draft, gstin: e.target.value.toUpperCase() })} placeholder="GST registration number" /></label><label className="field-label span-two">UPI ID<input value={draft.upi} onChange={(e) => setDraft({ ...draft, upi: e.target.value })} placeholder="dealer@bank" /></label></div><div className="modal-actions"><button type="button" className="button" onClick={() => setForm(false)}>Cancel</button><button className="button primary"><Check size={14} /> {editing ? 'Save changes' : 'Create workspace'}</button></div></form></Modal>}{notice && <div className="toast"><span><Check size={14} /></span>{notice}</div>}</div>
}
