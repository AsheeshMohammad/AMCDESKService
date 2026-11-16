'use client'

import { useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, ArrowUpRight as External, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, Clock3, Download, Ellipsis, Filter, Mail, MapPin, MessageCircle, MoreHorizontal,
  Package, Phone, Plus, Search, Send, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles,
  Users, Wrench, X,
} from 'lucide-react'
import { customers, inventory as seedInventory, invoices, jobs as seedJobs, money, products, revenueByMonth, technicians } from '@/lib/data'

export type ViewKey =
  | 'Dashboard' | 'WhatsApp Inbox' | 'WhatsApp Automation' | 'SERVICE STATUS' | 'Customers 360'
  | 'Services & Jobs' | 'Service Calendar' | 'AMC Management' | 'Technicians' | 'Inventory Spares'
  | 'RO Sales & Catalog' | 'Invoices & Billing' | 'Business Reports' | 'Business Settings'

type Props = {
  page: ViewKey
  tenant: { name: string; owner: string; city: string; gstin: string; upi: string; customDomain: string }
  onNavigate: (page: ViewKey) => void
  onToast: (message: string) => void
  onBook: () => void
  onSelectCustomer: (id: string) => void
}

function Panel({ children, className = '', ...props }: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  return <section {...props} className={`panel ${className}`}>{children}</section>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>
}

function Button({ children, variant = 'secondary', onClick, className = '' }: { children: React.ReactNode; variant?: 'secondary' | 'primary' | 'quiet' | 'success'; onClick?: () => void; className?: string }) {
  return <button className={`button ${variant} ${className}`} onClick={onClick}>{children}</button>
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

function Avatar({ name, color = 'blue', size = 'normal' }: { name: string; color?: string; size?: 'normal' | 'small' }) {
  return <span className={`avatar ${color} ${size}`}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
}

function Dashboard({ tenant, onNavigate, onToast }: Pick<Props, 'tenant' | 'onNavigate' | 'onToast'>) {
  const [broadcast, setBroadcast] = useState(false)
  const now = new Date()
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(now))
  const timeGreeting = localHour < 12 ? 'Good morning' : localHour < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now).toUpperCase()
  const stats = [
    { title: 'ACTIVE CUSTOMERS', value: '17', foot: 'Residential & Commercial RO', note: '+17 this month', icon: Users, tone: 'blue' },
    { title: 'URGENT OVERDUE', value: '0', foot: 'High risk of customer churn', note: 'Needs outreach', icon: CircleAlert, tone: 'red' },
    { title: "TODAY'S VISITS", value: '5', foot: `Doorstep servicing ${tenant.city}`, note: '5 techs active', icon: Wrench, tone: 'green' },
    { title: 'MONTH REVENUE', value: money(84503), foot: 'Pending: ₹0', note: 'Collected', icon: ArrowUpRight, tone: 'blue' },
  ]
  const opportunities = [
    { title: 'Filter Replacements', count: '0 due', amount: '₹0', note: 'Sediment & Pre-carbon candles due', icon: Package, tone: 'amber' },
    { title: 'AMC Renewals', count: '0 expiring', amount: '₹0', note: 'Annual contracts due this month', icon: ShieldCheck, tone: 'blue' },
    { title: 'Overdue Customers', count: '0 overdue', amount: '₹0', note: 'Overdue regular service recovery', icon: Clock3, tone: 'red' },
    { title: 'Pending Invoices', count: '0 unpaid', amount: '₹0', note: 'Collect via UPI link or on visit', icon: Mail, tone: 'green' },
  ]
  const radar = [
    { title: 'Overdue', value: '0', note: 'Immediate recovery', color: 'red', icon: CircleAlert },
    { title: 'Due < 7 Days', value: '1', note: 'Send reminders', color: 'amber', icon: Clock3 },
    { title: 'AMC Renewals', value: '0', note: 'Contracts expiring', color: 'blue', icon: ShieldCheck },
    { title: 'Pending Dues', value: '₹0', note: 'Unpaid balances', color: 'green', icon: ArrowDownRight },
    { title: "Today's Jobs", value: '5', note: 'Dispatched visits', color: 'blue', icon: Wrench },
  ]
  return <div className="dashboard-page">
    <div className="welcome-row">
      <div><div className="eyebrow"><span className="online-dot" /> {dateLabel}</div><h1>{timeGreeting}, {tenant.owner} <span className="wave">✦</span></h1><p><strong>{tenant.name}</strong> has <b>0 services overdue</b> and <b>5 technician visits</b> scheduled today.</p></div>
      <div className="welcome-actions"><Button onClick={() => window.print()}><Download size={15} /> Export PDF Report</Button><Button variant="primary" onClick={() => onNavigate('SERVICE STATUS')}>Open SERVICE STATUS <External size={14} /></Button></div>
    </div>
    <div className="stats-grid">{stats.map(({ title, value, foot, note, icon: Icon, tone }) => <Panel key={title} className={`stat-card ${tone === 'red' ? 'urgent-card' : ''}`}><div className="stat-top"><span className="stat-title">{title}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><div className="stat-value">{value}</div><div className={`stat-note ${tone}`}>{tone === 'red' && <CircleAlert size={12} />}{note}</div><div className="stat-foot">{foot}</div></Panel>)}</div>
    <Panel className="opportunity-panel">
      <div className="section-header"><div className="section-icon amber"><Sparkles size={17} /></div><div className="section-title-wrap"><div className="title-line"><h2>Revenue Opportunities <span className="subtitle-inline">(Money Left On The Table)</span></h2><Badge tone="amber">UNREALIZED REVENUE</Badge></div><p>Identified immediately from overdue filters, expired AMCs, and uncollected invoices</p></div><div className="potential"><span>TOTAL POTENTIAL REVENUE</span><strong>₹0</strong></div></div>
      <div className="opportunity-grid">{opportunities.map(({ title, count, amount, note, icon: Icon, tone }) => <div className="opportunity-tile" key={title}><div className="tile-title"><span><Icon size={15} /> {title}</span><Badge tone={tone}>{count}</Badge></div><strong>{amount}</strong><p>{note}</p></div>)}</div>
    </Panel>
    <Panel className="radar-panel">
      <div className="section-header"><div className="section-icon blue"><SlidersHorizontal size={17} /></div><div className="section-title-wrap"><div className="title-line"><h2>Today&apos;s Priority Radar</h2><Badge tone="blue">Action Required</Badge></div><p>Every morning the dealer should review and clear these items</p></div><button className="icon-button" aria-label="More options"><Ellipsis size={19} /></button></div>
      <div className="radar-grid">{radar.map(({ title, value, note, color, icon: Icon }) => <button className={`radar-tile ${color}`} key={title} onClick={() => onNavigate(title === 'Overdue' ? 'Customers 360' : title === "Today's Jobs" ? 'SERVICE STATUS' : title === 'AMC Renewals' ? 'AMC Management' : 'Services & Jobs')}><div><span className="radar-icon"><Icon size={15} /></span><span>{title}</span></div><strong>{value}</strong><small>{note}</small></button>)}<div className="radar-tile technicians-tile"><div><span className="radar-icon"><Users size={15} /></span><span>Technicians</span></div><strong>5 <small>Active</small></strong><div className="mini-avatars">{technicians.map((tech) => <Avatar key={tech.name} name={tech.name} color={tech.color} size="small" />)}</div></div></div>
    </Panel>
    <div className="whatsapp-bar"><div className="wa-left"><div className="wa-mark"><MessageCircle size={19} /></div><div><div className="title-line"><h2>WhatsApp Operations &amp; Live Chats</h2><Badge tone="green">LIVE DESK</Badge></div><p>Real-time customer inquiries, automated reminder dispatch, and 1-click service scheduling.</p></div></div><div className="wa-actions"><Button onClick={() => setBroadcast(true)}><Send size={14} /> Fast Broadcast</Button><Button variant="success" onClick={() => onNavigate('WhatsApp Inbox')}>Open WhatsApp Inbox <External size={14} /></Button></div></div>
    {broadcast && <Modal title="Fast Broadcast" onClose={() => setBroadcast(false)}><p className="modal-copy">Send a service update to your customers over WhatsApp.</p><label className="field-label">Message<textarea defaultValue="Hello! It's time for your RO purifier service. Reply here to book a convenient slot." /></label><div className="modal-actions"><Button onClick={() => setBroadcast(false)}>Cancel</Button><Button variant="success" onClick={() => { setBroadcast(false); onToast('Broadcast queued for 17 customers') }}><Send size={14} /> Send to 17 customers</Button></div></Modal>}
  </div>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal"><div className="modal-header"><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>
}

function Inbox({ onBook, onSelectCustomer }: Pick<Props, 'onBook' | 'onSelectCustomer'>) {
  const [selected, setSelected] = useState(0)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState<string[]>([])
  return <div className="page-content"><PageHeading eyebrow="CUSTOMER CONVERSATIONS" title="WhatsApp Inbox" description="Your customer conversations, service requests and follow-ups in one place." action={<Button variant="success"><span className="online-dot" /> WhatsApp connected</Button>} />
    <Panel className="inbox-panel"><div className="chat-list"><div className="chat-list-head"><div className="panel-title-row"><h3>Messages</h3><Badge tone="blue">4 unread</Badge></div><div className="search-box small"><Search size={14} /><input placeholder="Search conversations..." /></div></div>{customers.slice(0, 6).map((customer, i) => <button key={customer.id} className={`chat-contact ${selected === i ? 'selected' : ''}`} onClick={() => setSelected(i)}><Avatar name={customer.name} color={['blue', 'green', 'purple', 'amber'][i % 4]} /><span className="chat-contact-info"><strong>{customer.name}</strong><small>{['Can you send someone today?', 'Thanks, the water tastes great!', 'When is my next service due?', 'I have a leak under the sink.'][i % 4]}</small></span><span className="chat-time">{i === 0 ? '10:42' : `${i + 1}h`}{i < 2 && <i />}</span></button>)}</div>
      <div className="chat-thread"><div className="thread-header"><div className="contact-heading"><Avatar name={customers[selected].name} /><div><strong>{customers[selected].name}</strong><small><span className="online-dot" /> Available on WhatsApp</small></div></div><div className="thread-tools"><button className="icon-button" aria-label="Call"><Phone size={16} /></button><button className="icon-button" aria-label="More"><MoreHorizontal size={18} /></button></div></div><div className="messages"><div className="date-divider"><span>TODAY</span></div><div className="bubble customer-bubble">Hi, I think my purifier needs a filter change. The water flow has become slow.<small>10:32 AM</small></div><div className="bubble agent-bubble">Hi {customers[selected].name.split(' ')[0]}! I can help with that. I&apos;ll check the service schedule for your area. 👋<small>10:34 AM <Check size={11} /></small></div><div className="bubble customer-bubble">Can you send someone today?<small>10:42 AM</small></div>{sent.map((text, i) => <div className="bubble agent-bubble" key={`${text}-${i}`}>{text}<small>Just now <Check size={11} /></small></div>)}</div><form className="message-compose" onSubmit={(event) => { event.preventDefault(); if (message.trim()) { setSent((current) => [...current, message.trim()]); setMessage('') } }}><button type="button" className="icon-button"><Plus size={18} /></button><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type a message..." /><button className="send-button" type="submit" aria-label="Send message"><Send size={16} /></button></form></div>
      <div className="customer-context"><div className="context-title"><h3>Customer context</h3><button className="icon-button" onClick={() => onSelectCustomer(customers[selected].id)}><External size={14} /></button></div><div className="context-person"><Avatar name={customers[selected].name} color="blue" /><div><strong>{customers[selected].name}</strong><small>{customers[selected].phone}</small></div></div><div className="context-group"><small>INSTALLED PURIFIER</small><strong>{customers[selected].purifier}</strong><span>Serial · {customers[selected].serial}</span></div><div className="context-row"><span>AMC status</span><Badge tone="green">{customers[selected].amc}</Badge></div><div className="context-row"><span>Last TDS reading</span><strong>{customers[selected].lastTds} ppm</strong></div><div className="context-row"><span>Next service</span><strong>{customers[selected].nextService}</strong></div><Button variant="primary" className="full-button" onClick={onBook}><CalendarDays size={15} /> 1-Click Book Service</Button><button className="text-button" onClick={() => onSelectCustomer(customers[selected].id)}>View customer profile <ChevronRight size={14} /></button></div></Panel>
  </div>
}

function Automation({ onToast }: { onToast: Props['onToast'] }) {
  const [enabled, setEnabled] = useState([true, true, true, false])
  const rules = [
    ['Filter service reminder', 'Notify customers 7 days before filter replacement is due.', '7 days before due date'],
    ['AMC expiry · 30 days', 'Give customers time to compare plans and renew early.', '30 days before expiry'],
    ['Technician on the way', 'Share the technician name and live arrival window.', 'When job status changes'],
    ['Post-service follow-up', 'Request feedback and share a secure UPI payment link.', '2 hours after service'],
  ]
  return <div className="page-content"><PageHeading eyebrow="AUTOMATE THE FOLLOW-UP" title="WhatsApp Automation" description="Helpful, timely messages that keep every purifier in great shape." action={<Button variant="primary" onClick={() => onToast('Automation settings saved')}><Check size={15} /> Save changes</Button>} /><div className="automation-summary"><div className="summary-icon green"><MessageCircle size={18} /></div><div><strong>WhatsApp reminders are working for you</strong><p>4 active workflows · Sent with your business profile</p></div><Badge tone="green">CONNECTED</Badge></div><div className="automation-list">{rules.map(([title, description, timing], index) => <Panel className="automation-card" key={title}><div className="automation-icon"><MessageCircle size={17} /></div><div className="automation-copy"><div className="title-line"><h3>{title}</h3><Badge tone={enabled[index] ? 'green' : 'slate'}>{enabled[index] ? 'Active' : 'Paused'}</Badge></div><p>{description}</p><div className="automation-timing"><Clock3 size={13} /> {timing}</div><label className="field-label template-label">MESSAGE TEMPLATE<textarea defaultValue={index === 0 ? "Hi {{customer_name}}, your {{purifier_model}} filter service is due on {{due_date}}. Book a visit that works for you — reply here." : index === 1 ? "Hi {{customer_name}}, your {{plan_name}} AMC expires on {{expiry_date}}. Renew now to keep your purifier protected." : index === 2 ? "Your RO service technician {{technician_name}} is on the way! Estimated arrival: {{eta}}." : "Thanks for choosing {{business_name}}! Share your feedback and complete payment here: {{upi_link}}"} /></label></div><button className={`toggle ${enabled[index] ? 'on' : ''}`} onClick={() => setEnabled((current) => current.map((value, i) => i === index ? !value : value))} aria-label={`Toggle ${title}`}><span /></button></Panel>)}</div></div>
}

function ServiceBoard({ onToast }: { onToast: Props['onToast'] }) {
  const [jobs, setJobs] = useState(seedJobs)
  const statuses = ['Scheduled', 'Technician En Route', 'In Progress', 'Completed', 'Cancelled']
  return <div className="page-content"><PageHeading eyebrow="LIVE OPERATIONS" title="SERVICE STATUS" description="Track every doorstep visit from dispatch to completion." action={<><Button><Filter size={14} /> Today <ChevronDown size={14} /></Button><Button variant="primary" onClick={() => onToast('New service booking form opened')}><Plus size={15} /> New job</Button></>} />
    <div className="board-summary"><span><i className="status-dot blue-dot" /> 5 jobs today</span><span><i className="status-dot green-dot" /> 2 completed</span><span><i className="status-dot amber-dot" /> 1 in progress</span><span><i className="status-dot red-dot" /> 0 overdue</span></div>
    <div className="kanban-board">{statuses.map((status) => { const items = jobs.filter((job) => job.status === status); return <div className="kanban-column" key={status}><div className="kanban-heading"><span className={`column-dot ${status.toLowerCase().replaceAll(' ', '-')}`} /><strong>{status}</strong><Badge>{items.length}</Badge></div><div className="kanban-cards">{items.map((job) => <article className="job-card" key={job.id}><div className="job-card-top"><span>{job.id}</span><button className="icon-button"><MoreHorizontal size={16} /></button></div><h3>{job.customer}</h3><p><MapPin size={12} /> {job.address}</p><div className="job-type">{job.type}</div><div className="job-card-bottom"><div><Avatar name={job.technician} color={technicians.find((tech) => tech.name === job.technician)?.color} size="small" /><span>{job.technician}</span></div><span><Clock3 size={12} /> {job.time}</span></div><label className="assign-select"><span>Update status</span><select value={job.status} onChange={(event) => { setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: event.target.value } : item)); onToast(`${job.id} moved to ${event.target.value}`) }}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></label></article>)}</div></div> })}</div>
  </div>
}

function Customers({ onSelectCustomer }: Pick<Props, 'onSelectCustomer'>) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All customers')
  const visible = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.serial} ${customer.area}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All customers' || customer.amc === filter))
  return <div className="page-content"><PageHeading eyebrow="YOUR CUSTOMER BASE" title="Customers 360" description="One complete view of every customer, purifier and service history." action={<Button variant="primary"><Plus size={15} /> Add customer</Button>} />
    <Panel className="table-panel"><div className="table-toolbar"><div className="search-box"><Search size={15} /><input placeholder="Search customers, phone or serial..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="select-control" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All customers</option><option>Active</option><option>Expiring soon</option><option>Not covered</option></select><Button><Filter size={14} /> Filters</Button></div><div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>PURIFIER &amp; SERIAL</th><th>AREA</th><th>AMC STATUS</th><th>NEXT SERVICE</th><th></th></tr></thead><tbody>{visible.map((customer, index) => <tr key={customer.id} onClick={() => onSelectCustomer(customer.id)} className="clickable-row"><td><div className="customer-cell"><Avatar name={customer.name} color={['blue', 'purple', 'green', 'amber'][index % 4]} size="small" /><span><strong>{customer.name}</strong><small>{customer.phone}</small></span></div></td><td><strong>{customer.purifier}</strong><small>{customer.serial}</small></td><td>{customer.area}, Hyderabad</td><td><Badge tone={customer.amc === 'Active' ? 'green' : customer.amc === 'Expiring soon' ? 'amber' : 'slate'}>{customer.amc}</Badge></td><td className={customer.nextService === 'Overdue' ? 'text-red' : ''}>{customer.nextService}</td><td><ChevronRight size={15} /></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state">No customers match your search.</div>}</div><div className="table-footer"><span>Showing <strong>{visible.length}</strong> of 17 customers</span><div><button className="icon-button"><ChevronLeft size={15} /></button><Badge tone="blue">1</Badge><button className="icon-button"><ChevronRight size={15} /></button></div></div></Panel>
  </div>
}

function Jobs({ onBook }: Pick<Props, 'onBook'>) {
  const [type, setType] = useState('All job types')
  const list = seedJobs.filter((job) => type === 'All job types' || job.type === type)
  return <div className="page-content"><PageHeading eyebrow="FIELD SERVICE" title="Services & Jobs" description="A clear audit trail of every installation, service visit and repair." action={<Button variant="primary" onClick={onBook}><Plus size={15} /> Book a service</Button>} /><Panel className="table-panel"><div className="table-toolbar"><div className="search-box"><Search size={15} /><input placeholder="Search job ID, customer..." /></div><select className="select-control" value={type} onChange={(event) => setType(event.target.value)}><option>All job types</option><option>Installation</option><option>Routine Filter Change</option><option>Breakdown Repair</option><option>AMC Visit</option></select><Button><CalendarDays size={14} /> Date range</Button></div><div className="table-scroll"><table><thead><tr><th>JOB ID</th><th>CUSTOMER</th><th>SERVICE TYPE</th><th>TECHNICIAN</th><th>TDS IN / OUT</th><th>STATUS</th></tr></thead><tbody>{list.map((job) => <tr key={job.id}><td className="mono">{job.id}</td><td><strong>{job.customer}</strong><small>{job.address}</small></td><td>{job.type}</td><td><div className="customer-cell"><Avatar name={job.technician} size="small" />{job.technician}</div></td><td><span className="tds-reading">{job.inputTds}</span><span className="muted"> → </span><span className="tds-good">{job.outputTds} ppm</span></td><td><Badge tone={job.status === 'Completed' ? 'green' : job.status === 'In Progress' ? 'blue' : job.status === 'Technician En Route' ? 'amber' : 'slate'}>{job.status}</Badge></td></tr>)}</tbody></table></div></Panel></div>
}

function Calendar() {
  const [mode, setMode] = useState<'Day' | 'Week' | 'Month'>('Week')
  const [offset, setOffset] = useState(0)
  const colors = ['blue', 'purple', 'green', 'amber', 'pink']
  const [scheduled, setScheduled] = useState<(typeof seedJobs[number] & { rescheduledTo?: string })[]>(seedJobs)
  const [dragged, setDragged] = useState<string | null>(null)
  const anchorDate = new Date()
  if (mode === 'Month') {
    anchorDate.setDate(1)
    anchorDate.setMonth(anchorDate.getMonth() + offset)
  } else if (mode === 'Day') {
    anchorDate.setDate(anchorDate.getDate() + offset)
  } else {
    const weekday = (anchorDate.getDay() + 6) % 7
    anchorDate.setDate(anchorDate.getDate() - weekday + offset * 7)
  }
  const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const dates = mode === 'Month'
    ? Array.from({ length: 42 }, (_, index) => {
      const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
      first.setDate(first.getDate() - first.getDay() + index)
      return first
    })
    : Array.from({ length: mode === 'Day' ? 1 : 7 }, (_, index) => {
      const date = new Date(anchorDate)
      date.setDate(anchorDate.getDate() + index)
      return date
    })
  const todayKey = dateKey(new Date())
  const heading = mode === 'Month'
    ? anchorDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : mode === 'Day'
      ? anchorDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : `${dates[0].toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${dates[6].toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const getJobs = (date: Date, index: number) => scheduled.filter((job, jobIndex) =>
    job.rescheduledTo === dateKey(date) || (!job.rescheduledTo && (mode === 'Day' || mode === 'Month' ? dateKey(date) === todayKey : jobIndex % 5 === index)),
  )
  const moveJob = (date: Date) => {
    if (dragged) setScheduled((current) => current.map((job) => job.id === dragged ? { ...job, rescheduledTo: dateKey(date) } : job))
    setDragged(null)
  }
  const renderEvent = (job: (typeof scheduled)[number], color: string) => <div className={`calendar-event ${color}`} key={job.id} draggable onDragStart={() => setDragged(job.id)}><strong>{job.time}</strong><span>{job.customer}</span><small>{job.type}</small></div>
  return <div className="page-content"><PageHeading eyebrow="PLAN THE ROUTE" title="Service Calendar" description="See the team's visits at a glance and keep every day running on time." action={<Button variant="primary"><Plus size={15} /> Schedule visit</Button>} /><Panel className="calendar-panel"><div className="calendar-toolbar"><div className="calendar-nav"><button className="icon-button" onClick={() => setOffset((n) => n - 1)}><ChevronLeft size={17} /></button><button className="icon-button" onClick={() => setOffset((n) => n + 1)}><ChevronRight size={17} /></button><strong>{heading}</strong></div><div className="segmented">{(['Day', 'Week', 'Month'] as const).map((item) => <button className={mode === item ? 'active' : ''} key={item} onClick={() => { setMode(item); setOffset(0) }}>{item}</button>)}</div></div><div className="technician-legend">{technicians.map((tech, i) => <span key={tech.name}><i className={`legend-dot ${colors[i]}`} />{tech.name}</span>)}</div>{mode === 'Month' ? <div className="month-calendar">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="month-day-label" key={day}>{day}</div>)}{dates.map((date, index) => <div className={`month-cell ${date.getMonth() !== anchorDate.getMonth() ? 'outside-month' : ''} ${dateKey(date) === todayKey ? 'today' : ''}`} key={dateKey(date)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveJob(date)}><strong>{date.getDate()}</strong>{getJobs(date, index).map((job, jobIndex) => renderEvent(job, colors[technicians.findIndex((tech) => tech.name === job.technician) % colors.length] ?? colors[jobIndex % colors.length]))}</div>)}</div> : <div className={`calendar-grid ${mode === 'Day' ? 'day-view' : ''}`}><div className="time-column"><div className="day-spacer" />{['09 AM', '10 AM', '11 AM', '12 PM', '01 PM', '02 PM', '03 PM', '04 PM'].map((time) => <span key={time}>{time}</span>)}</div>{dates.map((date, index) => <div className={`calendar-day ${dateKey(date) === todayKey ? 'today' : ''}`} key={dateKey(date)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveJob(date)}><div className="day-heading">{date.toLocaleDateString('en-IN', { weekday: 'short' })} <strong>{date.getDate()}</strong></div>{getJobs(date, index).map((job, jobIndex) => renderEvent(job, colors[technicians.findIndex((tech) => tech.name === job.technician) % colors.length] ?? colors[jobIndex % colors.length]))}</div>)}</div>}<p className="calendar-hint">Drag a visit to another day to reschedule. Changes stay in this demo session.</p></Panel></div>
}

function AMC() {
  const rows = customers.slice(0, 8).map((customer, i) => ({ customer, plan: ['Comprehensive', 'Gold', 'Basic'][i % 3], start: '12 Jan 2025', end: i === 4 ? '21 Nov 2025' : `${10 + i} Jan 2026`, status: i === 4 ? 'Expiring soon' : i === 6 ? 'Expired' : 'Active', price: [8500, 11999, 4999][i % 3] }))
  return <div className="page-content"><PageHeading eyebrow="RECURRING REVENUE" title="AMC Management" description="Protect customer relationships and make renewals easy." action={<Button variant="primary"><Plus size={15} /> Create contract</Button>} /><div className="mini-stat-grid"><MiniStat icon={<ShieldCheck size={17} />} label="ACTIVE CONTRACTS" value="12" tone="green" /><MiniStat icon={<Clock3 size={17} />} label="EXPIRING IN 30 DAYS" value="1" tone="amber" /><MiniStat icon={<CircleAlert size={17} />} label="EXPIRED CONTRACTS" value="0" tone="red" /><MiniStat icon={<ArrowUpRight size={17} />} label="RENEWAL REVENUE" value="₹1,24,500" tone="blue" /></div><Panel className="table-panel"><div className="table-toolbar"><div className="search-box"><Search size={15} /><input placeholder="Search contracts..." /></div><Button><Filter size={14} /> Status: All</Button></div><div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>CONTRACT TIER</th><th>START DATE</th><th>END DATE</th><th>VALUE</th><th>STATUS</th><th></th></tr></thead><tbody>{rows.map(({ customer, plan, start, end, status, price }) => <tr key={customer.id}><td><div className="customer-cell"><Avatar name={customer.name} size="small" /><span><strong>{customer.name}</strong><small>{customer.phone}</small></span></div></td><td><Badge tone={plan === 'Gold' ? 'amber' : plan === 'Comprehensive' ? 'blue' : 'slate'}>{plan}</Badge></td><td>{start}</td><td>{end}</td><td className="mono">{money(price)}</td><td><Badge tone={status === 'Active' ? 'green' : status === 'Expired' ? 'red' : 'amber'}>{status}</Badge></td><td><button className="text-button"><MessageCircle size={14} /> Remind</button></td></tr>)}</tbody></table></div></Panel></div>
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <Panel className="mini-stat"><span className={`mini-stat-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></Panel>
}

function Technicians() {
  return <div className="page-content"><PageHeading eyebrow="FIELD TEAM" title="Technicians" description="Your service crew, their daily workload and field collections." action={<Button variant="primary"><Plus size={15} /> Add technician</Button>} /><div className="technician-grid">{technicians.map((tech) => <Panel className="technician-card" key={tech.name}><div className="tech-card-head"><Avatar name={tech.name} color={tech.color} /><div><strong>{tech.name}</strong><small><span className="online-dot" /> On duty · {tech.area}</small></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="tech-job-progress"><div><span>Jobs today</span><strong>{tech.done + tech.pending} <small>total</small></strong></div><div className="progress-track"><span style={{ width: `${tech.done / (tech.done + tech.pending) * 100}%` }} /></div><div className="progress-labels"><span>{tech.done} completed</span><span>{tech.pending} pending</span></div></div><div className="tech-metrics"><div><small>VAN STOCK</small><strong><Package size={14} /> 8 items</strong></div><div><small>CASH COLLECTED</small><strong className="text-green">{money(tech.cash)}</strong></div></div><Button className="full-button"><MapPin size={14} /> View route</Button></Panel>)}</div></div>
}

function Inventory() {
  const [stock, setStock] = useState(seedInventory)
  const [search, setSearch] = useState('')
  return <div className="page-content"><PageHeading eyebrow="PARTS & SUPPLIES" title="Inventory Spares" description="Stay stocked for every service call. Parts deduct automatically when used in a job." action={<Button variant="primary"><Plus size={15} /> Add spare</Button>} /><div className="mini-stat-grid"><MiniStat icon={<Package size={17} />} label="ACTIVE SKUS" value="24" tone="blue" /><MiniStat icon={<CircleAlert size={17} />} label="LOW STOCK ITEMS" value="2" tone="amber" /><MiniStat icon={<ShoppingBag size={17} />} label="STOCK VALUE" value="₹48,620" tone="green" /></div><Panel className="table-panel"><div className="table-toolbar"><div className="search-box"><Search size={15} /><input placeholder="Search parts or SKU..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button><Filter size={14} /> All stock</Button></div><div className="table-scroll"><table><thead><tr><th>SPARE PART</th><th>SKU</th><th>IN STOCK</th><th>MIN. LEVEL</th><th>UNIT COST</th><th>STOCK STATUS</th><th>ACTION</th></tr></thead><tbody>{stock.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(search.toLowerCase())).map((item) => <tr key={item.sku}><td><div className="product-cell-icon"><Package size={16} /></div><strong>{item.name}</strong></td><td className="mono">{item.sku}</td><td><strong>{item.stock}</strong> {item.unit}</td><td>{item.minimum} {item.unit}</td><td>{money(item.cost)}</td><td><Badge tone={item.stock <= item.minimum ? 'amber' : 'green'}>{item.stock <= item.minimum ? 'Low stock' : 'In stock'}</Badge></td><td><button className="text-button" onClick={() => setStock((current) => current.map((part) => part.sku === item.sku ? { ...part, stock: part.stock - 1 } : part))}><Package size={14} /> Use 1</button></td></tr>)}</tbody></table></div></Panel></div>
}

function Catalog({ onToast }: { onToast: Props['onToast'] }) {
  const [quote, setQuote] = useState<string | null>(null)
  return <div className="page-content"><PageHeading eyebrow="GROW YOUR SALES" title="RO Sales & Catalog" description="Compare dealer pricing, check stock and make a polished customer quote." action={<Button variant="primary" onClick={() => onToast('Product form ready')}><Plus size={15} /> Add product</Button>} /><div className="catalog-banner"><div className="catalog-banner-icon"><ShoppingBag size={20} /></div><div><strong>Dealer pricing at a glance</strong><p>Quotes include GST breakdown, installation and purifier exchange value.</p></div><Badge tone="green">3 PRODUCTS IN STOCK</Badge></div><div className="product-grid">{products.map((product) => <Panel className="product-card" key={product.name}><div className={`product-visual visual-${product.image}`}><div className="product-watermark">PURE<br />LIVING</div><div className="purifier-shape"><span /><i /><b /></div><Badge tone="green">{product.stock} in stock</Badge></div><div className="product-card-body"><small className="eyebrow">{product.type}</small><h3>{product.name}</h3><div className="product-prices"><span>MRP <strong>{money(product.mrp)}</strong></span><span>DEALER PRICE <strong className="text-green">{money(product.dealer)}</strong></span></div><div className="product-saving">Your margin <b>{money(product.mrp - product.dealer)}</b></div><div className="product-actions"><Button onClick={() => setQuote(product.name)}>Quick quote <External size={14} /></Button><Button variant="primary" onClick={() => onToast(`${product.name} added to a customer quote`)}><Plus size={14} /> Sell</Button></div></div></Panel>)}</div>{quote && <Modal title="Quick quote" onClose={() => setQuote(null)}><div className="quote-preview"><div className="brand-mini"><span className="watermark-drop">◈</span> SR WATER SOLUTIONS</div><div className="quote-info"><strong>{quote}</strong><span>Customer: Select customer</span><span>MRP: ₹18,999 · Dealer quote: ₹12,499</span><span>GST included · Installation available</span></div></div><div className="modal-actions"><Button onClick={() => setQuote(null)}>Close</Button><Button variant="primary" onClick={() => { setQuote(null); onToast('Quote copied and ready to share') }}><MessageCircle size={14} /> Share quote</Button></div></Modal>}</div>
}

function Billing({ tenant, onToast }: { tenant: Props['tenant']; onToast: Props['onToast'] }) {
  const [invoice, setInvoice] = useState<(typeof invoices)[number] | null>(null)
  const [filter, setFilter] = useState('All invoices')
  const filtered = invoices.filter((item) => filter === 'All invoices' || item.status === filter)
  return <div className="page-content"><PageHeading eyebrow="GST-READY BILLING" title="Invoices & Billing" description="Create clean GST invoices and collect payments with a single UPI link." action={<Button variant="primary" onClick={() => onToast('New invoice draft created')}><Plus size={15} /> Create invoice</Button>} /><div className="mini-stat-grid"><MiniStat icon={<ArrowUpRight size={17} />} label="COLLECTED THIS MONTH" value="₹84,503" tone="green" /><MiniStat icon={<Clock3 size={17} />} label="PAYMENTS PENDING" value="₹3,200" tone="amber" /><MiniStat icon={<CircleAlert size={17} />} label="OVERDUE INVOICES" value="₹3,200" tone="red" /><MiniStat icon={<Package size={17} />} label="GST COLLECTED" value="₹7,680" tone="blue" /></div><Panel className="table-panel"><div className="table-toolbar"><div className="search-box"><Search size={15} /><input placeholder="Search invoice or customer..." /></div><select className="select-control" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All invoices</option><option>Paid</option><option>Pending</option><option>Overdue</option></select><Button><Download size={14} /> Export</Button></div><div className="table-scroll"><table><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>ISSUED</th><th>DESCRIPTION</th><th>AMOUNT</th><th>STATUS</th><th></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td className="mono">{item.id}</td><td><strong>{item.customer}</strong><small>GSTIN: 36ABKFS4821L1Z8</small></td><td>{item.date}</td><td>{item.type}</td><td className="mono">{money(item.amount)}</td><td><Badge tone={item.status === 'Paid' ? 'green' : item.status === 'Overdue' ? 'red' : 'amber'}>{item.status}</Badge></td><td><button className="text-button" onClick={() => setInvoice(item)}><Download size={14} /> Preview</button></td></tr>)}</tbody></table></div></Panel>{invoice && <Modal title="Invoice preview" onClose={() => setInvoice(null)}><div className="invoice-preview"><div className="invoice-head"><div><div className="brand-mini">◈ {tenant.name}</div><span>{tenant.city} · India</span><span>GSTIN: {tenant.gstin}</span></div><strong>TAX INVOICE</strong></div><div className="invoice-number"><span>Invoice no. <b>{invoice.id}</b></span><span>Date <b>{invoice.date}</b></span></div><div className="invoice-bill-to"><small>BILL TO</small><strong>{invoice.customer}</strong><span>Hyderabad, Telangana</span></div><div className="invoice-line"><span>{invoice.type}</span><strong>{money(invoice.amount)}</strong></div><div className="invoice-total"><span>Total including GST</span><strong>{money(invoice.amount)}</strong></div><div className="upi-row"><div className="fake-qr">▦</div><span>Scan to pay via UPI<br /><b>{tenant.upi}</b></span></div></div><div className="modal-actions"><Button onClick={() => window.print()}><Download size={14} /> Print / Save PDF</Button><Button variant="primary" onClick={() => { setInvoice(null); onToast(`Payment link copied · ${tenant.upi}`) }}><MessageCircle size={14} /> Share payment link</Button></div></Modal>}</div>
}

function Reports() {
  const max = Math.max(...revenueByMonth.map((item) => item.amount))
  const exportCsv = () => {
    const rows = ['Month,Revenue (INR)', ...revenueByMonth.map((item) => `${item.month},${item.amount}`)]
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'ro-renewal-monthly-revenue.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  return <div className="page-content"><PageHeading eyebrow="KNOW YOUR BUSINESS" title="Business Reports" description="Make confident decisions with a live view of revenue, service and retention." action={<><Button onClick={exportCsv}><Download size={14} /> Export CSV</Button><Button onClick={() => window.print()}><Download size={14} /> Export PDF</Button></>} /><div className="report-kpis"><MiniStat icon={<ArrowUpRight size={17} />} label="REVENUE THIS MONTH" value="₹84,503" tone="green" /><MiniStat icon={<Users size={17} />} label="CUSTOMER RETENTION" value="94.2%" tone="blue" /><MiniStat icon={<Wrench size={17} />} label="JOBS COMPLETED" value="142" tone="amber" /><MiniStat icon={<ArrowDownRight size={17} />} label="CHURN THIS MONTH" value="1.8%" tone="red" /></div><div className="reports-grid"><Panel className="chart-panel revenue-chart"><div className="report-panel-heading"><div><h3>Monthly revenue</h3><p>Collected invoice value · last 6 months</p></div><Badge tone="green"><ArrowUpRight size={12} /> 10.2%</Badge></div><div className="chart-total">{money(84503)} <span>This month</span></div><div className="bar-chart">{revenueByMonth.map(({ month, amount }, index) => <div className="bar-column" key={month}><div className={`bar ${index === revenueByMonth.length - 1 ? 'current' : ''}`} style={{ height: `${amount / max * 100}%` }} title={money(amount)} /><span>{month}</span></div>)}</div></Panel><Panel className="chart-panel"><div className="report-panel-heading"><div><h3>Revenue mix</h3><p>AMCs and spares · this month</p></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="donut-wrap"><div className="donut"><div><strong>₹84.5k</strong><small>Total revenue</small></div></div><div className="donut-legend"><span><i className="legend-dot blue" /> AMC contracts <b>62%</b></span><span><i className="legend-dot green" /> Spares &amp; service <b>38%</b></span></div></div></Panel><Panel className="chart-panel performance-panel"><div className="report-panel-heading"><div><h3>Technician performance</h3><p>Completed visits this month</p></div><Badge>142 jobs</Badge></div><div className="performance-list">{technicians.slice(0, 4).map((tech, i) => <div className="performance-row" key={tech.name}><Avatar name={tech.name} color={tech.color} size="small" /><span>{tech.name}</span><div className="progress-track"><span style={{ width: `${[84, 72, 66, 58][i]}%` }} /></div><strong>{[38, 31, 28, 24][i]}</strong></div>)}</div></Panel><Panel className="chart-panel retention-panel"><div className="report-panel-heading"><div><h3>Customer retention</h3><p>Active customer base · last 6 months</p></div></div><div className="retention-value">94.2% <span className="text-green">+2.4%</span></div><div className="retention-bars">{[65, 69, 72, 71, 84, 94].map((value, i) => <div key={i}><span style={{ height: `${value}%` }} /><small>{['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][i]}</small></div>)}</div></Panel></div></div>
}

function Settings({ tenant, onToast }: { tenant: Props['tenant']; onToast: Props['onToast'] }) {
  return <div className="page-content"><PageHeading eyebrow="YOUR BUSINESS, YOUR BRAND" title="Business Settings" description="Manage the details that appear on customer messages, invoices and your workspace." action={<Button variant="primary" onClick={() => onToast('Business settings saved')}><Check size={15} /> Save changes</Button>} /><div className="settings-layout"><div className="settings-nav"><a className="selected" href="#profile">Business profile</a><a href="#domain">Custom domain</a><a href="#payments">Payments &amp; GST</a><a href="#whatsapp">WhatsApp connection</a><a href="#reminders">Service reminders</a></div><div className="settings-forms"><Panel className="settings-panel" id="profile"><div className="settings-panel-head"><div><h3>Business profile</h3><p>These details are shown across your customer communications.</p></div><Settings2 size={17} /></div><div className="logo-upload"><div className="logo-mark">◈</div><div><strong>Business logo</strong><small>SVG, PNG or JPG · max 2MB</small></div><Button>Upload logo</Button></div><div className="form-grid"><label className="field-label">BUSINESS NAME<input defaultValue={tenant.name} /></label><label className="field-label">OWNER NAME<input defaultValue={tenant.owner} /></label><label className="field-label">CITY<input defaultValue={tenant.city} /></label><label className="field-label">SUPPORT PHONE<input defaultValue="+91 98490 12345" /></label></div></Panel><Panel className="settings-panel" id="domain"><div className="settings-panel-head"><div><h3>Custom domain</h3><p>Connect your GoDaddy domain to give your team a branded sign-in page.</p></div></div><label className="field-label">CUSTOM DOMAIN<div className="input-with-prefix"><span>https://</span><input defaultValue={tenant.customDomain} /></div></label><div className="domain-status"><span className="online-dot" /> Domain connected <small>DNS verified · SSL active</small></div></Panel><Panel className="settings-panel" id="payments"><div className="settings-panel-head"><div><h3>Payments &amp; GST</h3><p>Used to create GST-ready invoices and customer UPI links.</p></div></div><div className="form-grid"><label className="field-label">GSTIN<input defaultValue={tenant.gstin} /></label><label className="field-label">UPI ID<input defaultValue={tenant.upi} /></label><label className="field-label">BANK ACCOUNT<input defaultValue="•••• •••• 4821" /></label><label className="field-label">GST RATE<input defaultValue="18%" /></label></div></Panel><Panel className="settings-panel" id="whatsapp"><div className="settings-panel-head"><div><h3>WhatsApp Business API</h3><p>Connect your official WhatsApp Business number for service reminders.</p></div><Badge tone="amber">Demo mode</Badge></div><div className="form-grid"><label className="field-label">PHONE NUMBER<input defaultValue="+91 98490 12345" /></label><label className="field-label">PHONE NUMBER ID<input placeholder="Enter your number ID" /></label><label className="field-label span-two">ACCESS TOKEN<input type="password" placeholder="Add your WhatsApp Cloud API token" /></label></div><div className="safe-note"><ShieldCheck size={15} /> Credentials are stored securely when backend connectivity is enabled.</div></Panel><Panel className="settings-panel" id="reminders"><div className="settings-panel-head"><div><h3>Default service reminders</h3><p>Set the timing for proactive customer follow-ups.</p></div></div><div className="form-grid"><label className="field-label">FILTER SERVICE REMINDER<select defaultValue="7 days"><option>3 days</option><option>7 days</option><option>14 days</option></select></label><label className="field-label">AMC RENEWAL REMINDER<select defaultValue="30 days"><option>15 days</option><option>30 days</option><option>45 days</option></select></label></div></Panel></div></div></div>
}

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const customer = customers.find((item) => item.id === id) ?? customers[0]
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="customer-drawer"><div className="drawer-header"><div><span className="eyebrow">CUSTOMER PROFILE</span><h2>Customer 360</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="drawer-profile"><Avatar name={customer.name} /><div><h3>{customer.name}</h3><span>{customer.phone}</span><small><MapPin size={12} /> {customer.area}, Hyderabad</small></div></div><div className="drawer-actions"><Button><Phone size={14} /> Call</Button><Button variant="success"><MessageCircle size={14} /> WhatsApp</Button></div><div className="drawer-section"><div className="drawer-section-head"><h3>Installed purifier</h3><Badge tone="green">Active</Badge></div><div className="unit-card"><div className="unit-icon">◈</div><div><strong>{customer.purifier}</strong><small>Serial: {customer.serial}</small></div></div><div className="qr-card"><div className="qr-pattern">▦ ▤<br />▥ ▦</div><span><strong>QR service sticker</strong><small>Scan to view service history</small><button className="text-button"><Download size={13} /> Download sticker</button></span></div></div><div className="drawer-section"><div className="drawer-section-head"><h3>Filter lifecycle</h3><span className="muted">Last changed · 12 Jun</span></div>{['Sediment filter', 'Pre-carbon', 'RO membrane', 'UV lamp'].map((name, i) => <div className="lifecycle-row" key={name}><span className="lifecycle-check"><Check size={11} /></span><span>{name}<small>{i === 0 ? 'Due in 5 days' : i === 1 ? 'Replaced 12 Jun 2025' : 'Replaced 12 Jun 2025'}</small></span><strong className={i === 0 ? 'text-amber' : ''}>{i === 0 ? 'DUE SOON' : 'HEALTHY'}</strong></div>)}</div><div className="drawer-section"><div className="drawer-section-head"><h3>Recent TDS readings</h3><button className="text-button">View log <ChevronRight size={13} /></button></div><div className="tds-chart"><span>Input water <strong>{customer.lastTds + 420} ppm</strong></span><span>Purified water <strong className="text-green">{customer.lastTds} ppm</strong></span><div className="tds-line"><i /><i /><i /></div><small>Last reading · 16 Nov 2025</small></div></div><div className="drawer-section"><div className="drawer-section-head"><h3>Past invoices</h3><button className="text-button">All invoices <ChevronRight size={13} /></button></div><div className="drawer-invoice"><span>INV-2025-0841<small>16 Nov 2025 · Filter replacement</small></span><strong>₹2,499</strong></div></div><Button variant="primary" className="full-button"><CalendarDays size={15} /> Book a service</Button></aside></div>
}

export default function Workspace({ page, tenant, onNavigate, onToast, onBook, onSelectCustomer }: Props) {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const openCustomer = (id: string) => { setSelectedCustomer(id); onSelectCustomer(id) }
  const content = (() => {
    switch (page) {
      case 'Dashboard': return <Dashboard tenant={tenant} onNavigate={onNavigate} onToast={onToast} />
      case 'WhatsApp Inbox': return <Inbox onBook={onBook} onSelectCustomer={openCustomer} />
      case 'WhatsApp Automation': return <Automation onToast={onToast} />
      case 'SERVICE STATUS': return <ServiceBoard onToast={onToast} />
      case 'Customers 360': return <Customers onSelectCustomer={openCustomer} />
      case 'Services & Jobs': return <Jobs onBook={onBook} />
      case 'Service Calendar': return <Calendar />
      case 'AMC Management': return <AMC />
      case 'Technicians': return <Technicians />
      case 'Inventory Spares': return <Inventory />
      case 'RO Sales & Catalog': return <Catalog onToast={onToast} />
      case 'Invoices & Billing': return <Billing tenant={tenant} onToast={onToast} />
      case 'Business Reports': return <Reports />
      case 'Business Settings': return <Settings tenant={tenant} onToast={onToast} />
    }
  })()
  return <>{content}{selectedCustomer && <CustomerDrawer id={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}</>
}
