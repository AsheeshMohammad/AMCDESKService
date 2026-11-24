'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Activity, BarChart3, CalendarDays, ChevronDown, ClipboardList, CreditCard, Droplets, Gauge, LayoutDashboard,
  LogOut, Menu, MessageCircle, Moon, Package, Settings, ShieldCheck, ShoppingBag, Sun, Users, Wrench, X,
} from 'lucide-react'
import Workspace, { type ViewKey } from '@/components/workspace'
import HelpChat from '@/components/help-chat'
import { getSupabaseClient } from '@/lib/supabase'

type Tenant = {
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

function isTenant(value: unknown): value is Tenant {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'string'
    && 'name' in value && typeof value.name === 'string'
    && 'slug' in value && typeof value.slug === 'string'
    && 'owner_name' in value && typeof value.owner_name === 'string'
    && 'updated_at' in value && typeof value.updated_at === 'string'
    && 'city' in value && typeof value.city === 'string'
    && 'business_phone' in value && (typeof value.business_phone === 'string' || value.business_phone === null)
    && 'business_email' in value && (typeof value.business_email === 'string' || value.business_email === null)
    && 'address' in value && (typeof value.address === 'string' || value.address === null)
    && 'gstin' in value && (typeof value.gstin === 'string' || value.gstin === null)
    && 'upi_id' in value && (typeof value.upi_id === 'string' || value.upi_id === null)
    && 'custom_domain' in value && (typeof value.custom_domain === 'string' || value.custom_domain === null)
}

const savedPageKey = 'amc-desk:last-page'
const savedTenantKey = 'amc-desk:last-tenant'
const savedThemeKey = 'amc-desk:theme'
const platformDomain = 'amcdesk.com'

function isViewKey(value: string | null): value is ViewKey {
  return navigation.some(({ name }) => name === value)
}

function currentPlatformTenantSlug() {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname.toLowerCase()
  if (hostname === platformDomain || hostname === `www.${platformDomain}`) return null
  return hostname.endsWith(`.${platformDomain}`)
    ? hostname.slice(0, -(platformDomain.length + 1))
    : null
}

function initialPage(): ViewKey {
  if (typeof window === 'undefined') return 'Dashboard'
  const savedPage = window.sessionStorage.getItem(savedPageKey)
  return isViewKey(savedPage) ? savedPage : 'Dashboard'
}

function initialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.sessionStorage.getItem(savedThemeKey) === 'dark' ? 'dark' : 'light'
}

function clearSavedWorkspace() {
  window.sessionStorage.removeItem(savedPageKey)
  window.sessionStorage.removeItem(savedTenantKey)
  window.sessionStorage.removeItem(savedThemeKey)
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index)
    if (key?.startsWith('amc-desk:snapshot:')) window.sessionStorage.removeItem(key)
  }
}

export default function AppShell() {
  const supabase = getSupabaseClient()
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [sessionError, setSessionError] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantRoles, setTenantRoles] = useState<Record<string, string>>({})
  const [tenantId, setTenantId] = useState('')
  const [membershipRefresh, setMembershipRefresh] = useState(0)
  const [tenantLoading, setTenantLoading] = useState(true)
  const [tenantError, setTenantError] = useState('')
  const [platformTenantSlug] = useState(currentPlatformTenantSlug)
  const [page, setPage] = useState<ViewKey>(initialPage)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeUrl, setNoticeUrl] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const updateTenant = useCallback((updatedTenant: Tenant) => {
    setTenants((current) => current.map((tenant) => tenant.id === updatedTenant.id ? updatedTenant : tenant))
  }, [])
  const navigateTo = useCallback((nextPage: ViewKey) => {
    setPage(nextPage)
    window.sessionStorage.setItem(savedPageKey, nextPage)
  }, [])
  const selectTenant = useCallback((nextTenantId: string) => {
    setTenantId(nextTenantId)
    window.sessionStorage.setItem(savedTenantKey, nextTenantId)
  }, [])

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setSessionError(error.message)
        setSessionReady(true)
        return
      }
      setUserEmail(data.session?.user.email ?? null)
      setSessionReady(true)
    }).catch((error: unknown) => {
      setSessionError(error instanceof Error ? error.message : 'Could not restore your sign-in session.')
      setSessionReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') {
        clearSavedWorkspace()
        setPage('Dashboard')
        setTheme('light')
      }
      setUserEmail(session?.user.email ?? null)
      setTenants([])
      setTenantRoles({})
      setTenantId('')
      setTenantError('')
      setTenantLoading(true)
      setMembershipRefresh((current) => current + 1)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!supabase || !userEmail) return
    let active = true
    void Promise.resolve(supabase
      .from('tenant_memberships')
      .select('role, tenant:tenants!inner(id, name, slug, owner_name, updated_at, city, business_phone, business_email, address, gstin, upi_id, custom_domain)')
      .order('created_at', { ascending: true }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTenantError(error.message)
        } else {
          const memberships = (data ?? []) as unknown as MembershipRow[]
          const platformTenant = platformTenantSlug
            ? memberships.find((membership) => membership.tenant.slug === platformTenantSlug)
            : undefined
          if (platformTenantSlug && !platformTenant) {
            setTenants([])
            setTenantRoles({})
            setTenantId('')
            setTenantError(`Your account does not have access to ${platformTenantSlug}.${platformDomain}.`)
            return
          }
          const accessibleMemberships = platformTenant ? [platformTenant] : memberships
          const available = accessibleMemberships.map((membership) => membership.tenant)
          const roles = Object.fromEntries(accessibleMemberships.map((membership) => [membership.tenant.id, membership.role]))
          const savedTenant = window.sessionStorage.getItem(savedTenantKey)
          setTenants(available)
          setTenantRoles(roles)
          selectTenant(available.find((tenant) => tenant.id === savedTenant)?.id ?? available[0]?.id ?? '')
        }
      })
      .catch((error: unknown) => {
        if (active) setTenantError(error instanceof Error ? error.message : 'Could not load your workspaces.')
      })
      .finally(() => {
        if (active) setTenantLoading(false)
      })

    return () => { active = false }
  }, [membershipRefresh, platformTenantSlug, selectTenant, supabase, userEmail])

  const selectedTenant = tenants.find((tenant) => tenant.id === tenantId)

  async function signOut() {
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setNotice(error.message)
      } else {
        clearSavedWorkspace()
        setPage('Dashboard')
        setTheme('light')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not sign out.')
    }
  }

  if (!supabase) {
    return <SetupNotice />
  }

  if (!sessionReady) {
    return <div className="auth-screen"><div className="panel auth-card">Connecting to Supabase…</div></div>
  }

  if (sessionError) {
    return <div className="auth-screen"><div className="panel auth-card"><h1>Session unavailable</h1><p>{sessionError}</p><button className="button primary" onClick={() => window.location.reload()}>Try again</button></div></div>
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
    return <CreateWorkspace onCreated={(tenant) => {
      setTenants([tenant])
      setTenantRoles({ [tenant.id]: 'owner' })
      selectTenant(tenant.id)
      setNotice('Company registered. Your URL:')
      setNoticeUrl(`https://${tenant.slug}.amcdesk.com`)
      window.setTimeout(() => { setNotice(''); setNoticeUrl('') }, 8000)
    }} onSignOut={signOut} />
  }

  const toast = (message: string) => {
    setNotice(message)
    setNoticeUrl('')
    window.setTimeout(() => setNotice(''), 3500)
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    window.sessionStorage.setItem(savedThemeKey, nextTheme)
  }

  return <div className="app-shell" data-theme={theme}>
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
      <div className="brand-row"><div className="brand-symbol"><Droplets size={18} /></div><div className="brand-name">AMC Desk</div><button className="mobile-close icon-button" onClick={() => setSidebarOpen(false)}><X size={17} /></button></div>
      <div className="brand-tagline">Service operations<br />for your business.</div>
      <label className="workspace-picker">
        <div className="workspace-logo">{selectedTenant.name.slice(0, 2).toUpperCase()}</div>
        <span className="workspace-copy"><strong>{selectedTenant.name}</strong><small>{selectedTenant.city || 'Workspace'}</small></span>
        <ChevronDown size={14} />
        <select aria-label="Switch workspace" value={tenantId} onChange={(event) => selectTenant(event.target.value)}>
          {tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}
        </select>
      </label>
      <nav className="sidebar-nav">{navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${page === name ? 'active' : ''}`} onClick={() => { navigateTo(name); setSidebarOpen(false) }}><Icon size={17} /><span>{name}</span></button>)}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-footer"><span>{userEmail}</span></div>
        <button className="logout-sidebar" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </div>
    </aside>
    <main className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><span className="topbar-brand"><Droplets size={17} /><strong>AMC Desk</strong></span><div className="breadcrumb"><span>{selectedTenant.name}</span><strong>{page}</strong></div></div>
        <div className="topbar-tools"><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></button><span className="sync-pill" title="Supabase connected"><i className="online-dot" /><span>Supabase connected</span></span><button className="button header-book" onClick={() => navigateTo('Services & Jobs')}><CalendarDays size={14} /> Services</button><button className="button primary header-add" onClick={() => navigateTo('Customers 360')}><Users size={15} /> Customers</button><button className="header-logout" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button></div>
      </header>
      <div className="workspace"><Workspace key={`${selectedTenant.id}-${page}`} page={page} tenantId={selectedTenant.id} role={tenantRoles[selectedTenant.id]} theme={theme} tenant={selectedTenant} onToast={toast} onNavigate={navigateTo} onTenantUpdated={updateTenant} /></div>
      <footer className="app-footer"><span>AMC Desk · {selectedTenant.name}</span><span>{userEmail}</span></footer>
    </main>
    <HelpChat />
    {notice && <div className="toast">{notice}{noticeUrl && <> <a href={noticeUrl} target="_blank" rel="noreferrer">{noticeUrl.replace('https://', '')}</a></>}<button onClick={() => { setNotice(''); setNoticeUrl('') }} aria-label="Dismiss"><X size={14} /></button></div>}
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
  const [adminName, setAdminName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
          email,
          password,
          options: { data: { business_name: business.trim(), admin_name: adminName.trim() } },
        })
      if (result.error) {
        setError(result.error.message)
      } else if (result.data.session) {
        onAuthenticated(result.data.session.user.email ?? email)
      } else {
        setMessage('Check your email to confirm your account, then sign in.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not contact Supabase. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-screen"><form className="panel auth-card" onSubmit={submit}>
    <div className="brand-symbol"><Droplets size={18} /></div><div className="eyebrow">AMC DESK</div>
    <h1>{mode === 'sign-in' ? 'Sign in to your workspace' : 'Register your company'}</h1>
    <p>Use your account to securely access your service data.</p>
    {mode === 'sign-up' && <>
      <label className="field-label">COMPANY NAME<input required maxLength={160} value={business} onChange={(event) => setBusiness(event.target.value)} autoComplete="organization" /></label>
      <label className="field-label">ADMIN NAME<input required maxLength={160} value={adminName} onChange={(event) => setAdminName(event.target.value)} autoComplete="name" /></label>
    </>}
    <label className="field-label">EMAIL<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="field-label">PASSWORD<input required type="password" minLength={8} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="button primary full-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Register company'}</button>
    <button type="button" className="text-button auth-switch" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage('') }}>{mode === 'sign-in' ? 'Register Company' : 'Already registered? Sign in'}</button>
  </form></div>
}

function CreateWorkspace({ onCreated, onSignOut }: { onCreated: (tenant: Tenant) => void; onSignOut: () => void }) {
  const supabase = getSupabaseClient()
  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!active) return
      if (userError) {
        setError(userError.message)
        return
      }
      const metadata = data.user?.user_metadata
      if (typeof metadata?.business_name === 'string') setName((current) => current || metadata.business_name)
      if (typeof metadata?.admin_name === 'string') setOwnerName((current) => current || metadata.admin_name)
    }).catch((userError: unknown) => {
      if (active) setError(userError instanceof Error ? userError.message : 'Could not load your registration details.')
    })
    return () => { active = false }
  }, [supabase])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const sessionResult = await supabase.auth.getSession()
      if (sessionResult.error) {
        setError(sessionResult.error.message)
        return
      }
      if (!sessionResult.data.session) {
        setError('Please sign in again. Your Supabase session is missing.')
        return
      }
      const { data: tenant, error: resultError } = await supabase
        .rpc('create_tenant', {
          p_name: name.trim(),
          p_owner_name: ownerName.trim(),
          p_city: city.trim(),
        })
        .single()

      if (resultError || !isTenant(tenant)) {
        setError(
          resultError
            ? `${resultError.message}${resultError.code ? ` [${resultError.code}]` : ''}`
            : 'Company registration returned an invalid workspace record.',
        )
        return
      }

      onCreated(tenant)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create the workspace. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-screen"><form className="panel auth-card" onSubmit={submit}><div className="brand-symbol"><Droplets size={18} /></div><h1>Finish company registration</h1><p>Your company workspace and admin access will be created together.</p><label className="field-label">COMPANY NAME<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-label">ADMIN NAME<input required maxLength={160} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></label><label className="field-label">CITY<input maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full-button" disabled={busy}>{busy ? 'Registering…' : 'Register company'}</button><button type="button" className="text-button auth-switch" onClick={onSignOut}>Sign out</button></form></div>
}
