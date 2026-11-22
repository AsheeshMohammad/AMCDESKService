'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronRight, CircleHelp, MessageCircle, X } from 'lucide-react'

const helpTopics = [
  {
    id: 'customers',
    label: 'Add a customer',
    prompt: 'How do I add a customer?',
    response: 'Open Customers 360 and select Add customer. Enter the customer name and phone number, then save. Only mark WhatsApp opt-in if the customer has explicitly agreed to receive messages.',
  },
  {
    id: 'services',
    label: 'Book a service',
    prompt: 'How do I book a service?',
    response: 'From Dashboard or Services & Jobs, select Book service. Choose the customer, service type, date and time, and optionally assign a technician. Save to add it to your jobs and service calendar.',
  },
  {
    id: 'jobs',
    label: 'Track a job',
    prompt: 'Where can I update a job status?',
    response: 'Open Services & Jobs, SERVICE STATUS, or Service Calendar. Find the job and use its status menu to update progress, for example to In Progress or Completed.',
  },
  {
    id: 'amc',
    label: 'Manage AMC contracts',
    prompt: 'How do I add an AMC contract?',
    response: 'Open AMC Management and select Add record. Choose a customer, plan, amount, start date, and end date, then save. The dashboard highlights contracts that are ending soon.',
  },
  {
    id: 'invoices',
    label: 'Create an invoice',
    prompt: 'How do I create an invoice?',
    response: 'Open Invoices & Billing and select Create invoice. Choose the customer, add a description, and enter the subtotal and GST amount. Save to create the invoice record.',
  },
  {
    id: 'whatsapp',
    label: 'Send a WhatsApp message',
    prompt: 'How do I message a customer on WhatsApp?',
    response: 'Open WhatsApp Inbox and select Send WhatsApp. Choose a customer who has opted in. The customer must also have messaged your business number within the last 24 hours. Meta WhatsApp credentials and the webhook must be configured first.',
  },
  {
    id: 'reports',
    label: 'Explore reports',
    prompt: 'How do I change a report?',
    response: 'Open Business Reports. Use the Metric, Chart Type, and Range menus to customize the graph. You can compare customer growth, jobs, AMC end dates, and paid revenue using 2D or 3D charts.',
  },
  {
    id: 'inventory',
    label: 'Manage team and stock',
    prompt: 'Where do I manage technicians and spare parts?',
    response: 'Use Technicians to add your field-service team and Inventory Spares to track stock and minimum levels. RO Sales & Catalog is for your products, prices, and available stock.',
  },
]

export default function HelpChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId)

  useEffect(() => {
    if (!isOpen) return

    closeRef.current?.focus()
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        launcherRef.current?.focus()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  return <>
    {isOpen && <section id="help-chat-dialog" className="help-chat-panel" role="dialog" aria-modal="false" aria-labelledby="help-chat-title">
      <header className="help-chat-header">
        <span className="help-chat-avatar"><Bot size={19} /></span>
        <div><h2 id="help-chat-title">AMC Desk guide</h2><p>Quick answers to using your workspace</p></div>
        <button ref={closeRef} type="button" className="help-chat-close" onClick={() => setIsOpen(false)} aria-label="Close help chat"><X size={18} /></button>
      </header>
      <div className="help-chat-body" aria-live="polite">
        <div className="help-chat-message bot-message">
          <span>Hi! I can help you find your way around AMC Desk. Choose a topic to see the steps.</span>
        </div>
        {activeTopic ? <>
          <div className="help-chat-message user-message">{activeTopic.prompt}</div>
          <div className="help-chat-message bot-message"><span>{activeTopic.response}</span></div>
          <button type="button" className="help-chat-topics-back" onClick={() => setActiveTopicId(null)}>
            Browse all help topics
          </button>
        </> : <div className="help-chat-topics">
          {helpTopics.map((topic) => <button type="button" key={topic.id} onClick={() => setActiveTopicId(topic.id)}>
            <span>{topic.label}</span><ChevronRight size={15} />
          </button>)}
        </div>}
      </div>
      <footer className="help-chat-footer"><CircleHelp size={13} /> Help topics are predefined app instructions.</footer>
    </section>}
    <button
      ref={launcherRef}
      type="button"
      className={`help-chat-launcher ${isOpen ? 'is-open' : ''}`}
      onClick={() => setIsOpen((open) => !open)}
      aria-label={isOpen ? 'Close help chat' : 'Open help chat'}
      aria-expanded={isOpen}
      aria-controls="help-chat-dialog"
    >
      {isOpen ? <X size={20} /> : <><MessageCircle size={19} /><span>Help</span></>}
    </button>
  </>
}
