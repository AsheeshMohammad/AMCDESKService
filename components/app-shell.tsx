'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  Activity, BarChart3, CalendarDays, ChevronDown, ClipboardList, CreditCard, Droplets, Gauge, LayoutDashboard,
  LogOut, Menu, MessageCircle, Package, Settings, ShieldCheck, ShoppingBag, Users, Wrench, X,
} from 'lucide-react'
import Workspace, { type ViewKey } from '@/components/workspace'
import { getSupabaseClient } from '@/lib/supabase'

type Tenant = {
  id: string
  name: string
  slug: string
  city: string | null
  gstin: string | null
  upi_id: string | null
  custom_domain: string | null
}

type MembershipRow = { role: string; tenant: Tenant }
const navigation: { name: ViewKey; icon: typeof LayoutDashboard }[] = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'WhatsApp Inbox', icon: MessageCircle },
  { name: 'WhatsApp Automation', icon: Activity },
  { name: 'SERVICE STATUS', icon: Gauge },
  { name: 'Customers 360', icon: Users },
  { name: 'Services & Jobs', icon: ClipboardList },
  { name: 'Service Calendar', icon: CalendarDays },
  { name: 'AMC Management', icon: ShieldCheck },
  { name: 'Technicians', icon: Wrench },
  { name: 'Inventory Spares', icon: Package },
  { name: 'RO Sales & Catalog', icon: ShoppingBag },
  { name: 'Invoices & Billing', icon: CreditCard },
  { name: 'Business Reports', icon: BarChart3 },
  { name: 'Business Settings', icon: Settings },
]

export default function AppShell() {
  const supabase = getSupabaseClient()
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantRoles, setTenantRoles] = useState<Record<string, string>>({})
  const [tenantId, setTenantId] = useState('')
  const [tenantLoading, setTenantLoading] = useState(true)
  const [tenantError, setTenantError] = useState('')
  const [page, setPage] = useState<ViewKey>('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(error.message)
      setUserEmail(data.session?.user.email ?? null)
      setSessionReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return
      setUserEmail(session?.user.email ?? null)
      setTenants([])
      setTenantRoles({})
      setTenantId('')
      setTenantError('')
      setTenantLoading(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!supabase || !userEmail) return
    let active = true
    supabase
      .from('tenant_memberships')
      .select('role, tenant:tenants!inner(id, name, slug, city, gstin, upi_id, custom_domain)')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTenantError(error.message)
        } else {
          const memberships = (data ?? []) as unknown as MembershipRow[]
          const available = memberships.map((membership) => membership.tenant)
          const roles = Object.fromEntries(memberships.map((membership) => [membership.tenant.id, membership.role]))
          setTenants(available)
          setTenantRoles(roles)
          setTenantId(available[0]?.id ?? '')
        }
        setTenantLoading(false)
      })

    return () => { active = false }
  }, [supabase, userEmail])

  const selectedTenant = tenants.find((tenant) => tenant.id === tenantId)

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setNotice(error.message)
  }

  if (!supabase) {
    return <SetupNotice />
  }

  if (!sessionReady) {
    return <div className="auth-screen"><div className="panel auth-card">Connecting to Supabase…</div></div>
  }

  if (!userEmail) {
    return <AuthScreen onAuthenticated={(email) => setUserEmail(email)} />
  }

  if (tenantLoading) {
    return <div className="auth-screen"><div className="panel auth-card">Loading your workspace…</div></div>
  }

  if (tenantError) {
    return <div className="auth-screen"><div className="panel auth-card"><h1>Workspace unavailable</h1><p>{tenantError}</p><button className="button" onClick={signOut}>Sign out</button></div></div>
  }

  if (!selectedTenant) {
    return <CreateWorkspace onCreated={(tenant) => { setTenants([tenant]); setTenantRoles({ [tenant.id]: 'owner' }); setTenantId(tenant.id) }} onSignOut={signOut} />
  }

  const toast = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  return <div className="app-shell" data-theme="light">
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
      <div className="brand-row"><div className="brand-symbol"><Droplets size={18} /></div><div className="brand-name">AMC Desk</div><button className="mobile-close icon-button" onClick={() => setSidebarOpen(false)}><X size={17} /></button></div>
      <div className="brand-tagline">Service operations<br />for your business.</div>
      <label className="workspace-picker">
        <div className="workspace-logo">{selectedTenant.name.slice(0, 2).toUpperCase()}</div>
        <span className="workspace-copy"><strong>{selectedTenant.name}</strong><small>{selectedTenant.city || 'Workspace'}</small></span>
        <ChevronDown size={14} />
        <select aria-label="Switch workspace" value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
          {tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}
        </select>
      </label>
      <nav className="sidebar-nav">{navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${page === name ? 'active' : ''}`} onClick={() => { setPage(name); setSidebarOpen(false) }}><Icon size={17} /><span>{name}</span></button>)}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-footer"><span>{userEmail}</span></div>
        <button className="logout-sidebar" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </div>
    </aside>
    <main className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><div className="breadcrumb"><span>{selectedTenant.name}</span><strong>{page}</strong></div></div>
        <div className="topbar-tools"><span className="sync-pill">Supabase connected</span><button className="button header-book" onClick={() => setPage('Services & Jobs')}><CalendarDays size={14} /> Services</button><button className="button primary header-add" onClick={() => setPage('Customers 360')}><Users size={15} /> Customers</button><button className="header-logout" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button></div>
      </header>
      <div className="workspace"><Workspace key={`${selectedTenant.id}-${page}`} page={page} tenantId={selectedTenant.id} role={tenantRoles[selectedTenant.id]} tenant={selectedTenant} onToast={toast} onNavigate={setPage} /></div>
      <footer className="app-footer"><span>AMC Desk · {selectedTenant.name}</span><span>{userEmail}</span></footer>
    </main>
    {notice && <div className="toast">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
  </div>
}

function SetupNotice() {
  return <div className="auth-screen"><div className="panel auth-card"><div className="brand-symbol"><Droplets size={18} /></div><h1>Connect Supabase</h1><p>Add your project URL and publishable anon key to <code>.env.local</code>, then restart the app.</p><pre>NEXT_PUBLIC_SUPABASE_URL=…{'\n'}NEXT_PUBLIC_SUPABASE_ANON_KEY=…</pre></div></div>
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (email: string) => void }) {
  const supabase = getSupabaseClient()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [business, setBusiness] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setMessage('')
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { business_name: business } } })
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
    } else if (result.data.session) {
      onAuthenticated(result.data.session.user.email ?? email)
    } else {
      setMessage('Check your email to confirm your account, then sign in.')
    }
  }

  return <div className="auth-screen"><form className="panel auth-card" onSubmit={submit}>
    <div className="brand-symbol"><Droplets size={18} /></div><div className="eyebrow">AMC DESK</div>
    <h1>{mode === 'sign-in' ? 'Sign in to your workspace' : 'Create your workspace'}</h1>
    <p>Use your account to securely access your service data.</p>
    {mode === 'sign-up' && <label className="field-label">BUSINESS NAME<input required value={business} onChange={(event) => setBusiness(event.target.value)} autoComplete="organization" /></label>}
    <label className="field-label">EMAIL<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="field-label">PASSWORD<input required type="password" minLength={8} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="button primary full-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
    <button type="button" className="text-button auth-switch" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage('') }}>{mode === 'sign-in' ? 'New to AMC Desk? Create an account' : 'Already registered? Sign in'}</button>
  </form></div>
}

function CreateWorkspace({ onCreated, onSignOut }: { onCreated: (tenant: Tenant) => void; onSignOut: () => void }) {
  const supabase = getSupabaseClient()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const sessionResult = await supabase.auth.getSession()
    if (!sessionResult.data.session) {
      setBusy(false)
      setError('Please sign in again. Your Supabase session is missing.')
      return
    }
    const userResult = await supabase.auth.getUser()
    const user = userResult.data.user
    if (!user) {
      setBusy(false)
      setError('Authentication is required')
      return
    }

    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'
    const tenantId = crypto.randomUUID()
    const slug = `${baseSlug}-${tenantId.slice(0, 8)}`
    const { data: tenant, error: resultError } = await supabase
      .from('tenants')
      .insert({
        id: tenantId,
        name: name.trim(),
        owner_name: user.email?.split('@')[0] || 'Owner',
        city: city.trim(),
        slug,
      })
      .select('id, name, slug, city, gstin, upi_id, custom_domain')
      .single()

    if (resultError || !tenant) {
      setBusy(false)
      setError(
        resultError
          ? `${resultError.message}${resultError.code ? ` [${resultError.code}]` : ''}`
          : 'Could not create workspace',
      )
      return
    }

    const { error: membershipError } = await supabase
      .from('tenant_memberships')
      .insert({ tenant_id: tenantId, user_id: user.id, role: 'owner' })

    setBusy(false)
    if (membershipError) {
      setError(
        `${membershipError.message}${membershipError.code ? ` [${membershipError.code}]` : ''}`,
      )
      return
    }
    onCreated(tenant)
  }

  return <div className="auth-screen"><form className="panel auth-card" onSubmit={submit}><div className="brand-symbol"><Droplets size={18} /></div><h1>Create a workspace</h1><p>Your account is authenticated, but it does not have a dealer workspace yet.</p><label className="field-label">BUSINESS NAME<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-label">CITY<input value={city} onChange={(event) => setCity(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full-button" disabled={busy}>{busy ? 'Creating…' : 'Create workspace'}</button><button type="button" className="text-button auth-switch" onClick={onSignOut}>Sign out</button></form></div>
}
