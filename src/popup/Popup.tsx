import { useEffect, useState } from 'react'
import { addApplication } from '../shared/storage'
import type { Application, Status } from '../shared/types'

const today = () => new Date().toLocaleDateString('sv-SE')

const field: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 6,
  marginBottom: 8,
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function extractJobDetails(): { role: string; company: string } {
  type Posting = { title?: string; company?: string }

  const findPosting = (value: unknown): Posting | undefined => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findPosting(item)
        if (found) return found
      }
    } else if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>
      const type = record['@type']
      if (
        ((typeof type === 'string' && type.endsWith('JobPosting')) ||
          (Array.isArray(type) && type.some((entry) => typeof entry === 'string' && entry.endsWith('JobPosting')))) &&
        typeof record.title === 'string'
      ) {
        const organization = record.hiringOrganization
        return {
          title: record.title,
          company:
            typeof organization === 'object' &&
            organization !== null &&
            'name' in organization &&
            typeof organization.name === 'string'
              ? organization.name
              : undefined,
        }
      }
      return findPosting(record['@graph'])
    }
    return undefined
  }

  let posting: Posting | undefined
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      posting = findPosting(JSON.parse(script.textContent ?? '') as unknown)
    } catch {
      continue
    }
    if (posting) break
  }

  const meta = (selector: string) =>
    document.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? ''
  const role =
    posting?.title ||
    document.querySelector('h1')?.textContent?.trim() ||
    meta('meta[property="og:title"]') ||
    document.title

  return {
    role,
    company: posting?.company || '',
  }
}

export default function Popup() {
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('applied')
  const [dateApplied, setDateApplied] = useState(today())
  const [followUpDate, setFollowUpDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [message, setMessage] = useState('')
  const [id] = useState(() => crypto.randomUUID())

  useEffect(() => {
    async function loadTab() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        setRole(tab?.title ?? '')
        setUrl(tab?.url ?? '')
        if (tab?.id === undefined) return

        const [injection] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractJobDetails,
        })
        if (injection?.result) {
          if (injection.result.role) setRole(injection.result.role)
          if (injection.result.company) setCompany(injection.result.company)
        }
      } catch {
        setMessage('Could not read this page automatically. You can still enter the details.')
      }
    }

    void loadTab()
  }, [])

  async function save(allowDuplicate = false) {
    setSaving(true)
    setMessage('')
    const application: Application = {
      id,
      role: role.trim(),
      company: company.trim(),
      url,
      source: (() => {
        try {
          return new URL(url).hostname.replace(/^www\./, '')
        } catch {
          return ''
        }
      })(),
      status,
      dateSaved: today(),
      dateApplied: status === 'saved' ? null : dateApplied,
      followUpDate,
      nextAction: nextAction.trim(),
      notes: notes.trim(),
      statusHistory: [{ status, changedAt: new Date().toISOString() }],
    }

    try {
      const existing = await addApplication(application, allowDuplicate)
      if (existing) {
        setDuplicate(true)
        setMessage(`A similar application already exists: ${existing.role} at ${existing.company}.`)
      } else {
        setSaved(true)
        setDuplicate(false)
      }
    } catch (reason) {
      setMessage(`Could not save this application: ${getErrorMessage(reason)}`)
    } finally {
      setSaving(false)
    }
  }

  function openDashboard() {
    void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
  }

  if (saved) {
    return (
      <div style={{ padding: 12 }}>
        <h3>Saved</h3>
        <button onClick={openDashboard}>Open dashboard</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif', fontSize: 14 }}>
      <h3 style={{ marginTop: 0 }}>Save application</h3>
      <input style={field} placeholder="Job title" value={role} onChange={(e) => setRole(e.target.value)} />
      <input style={field} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
      <select style={field} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
        <option value="saved">Saved (not applied yet)</option>
        <option value="applied">Applied</option>
        <option value="interview">Interview</option>
        <option value="offer">Offer</option>
        <option value="rejected">Rejected</option>
        <option value="no_reply">No reply</option>
      </select>
      {status !== 'saved' && (
        <label style={{ display: 'block' }}>
          Date applied
          <input style={field} type="date" value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} />
        </label>
      )}
      <label style={{ display: 'block' }}>
        Follow-up date
        <input style={field} type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
      </label>
      <input
        style={field}
        placeholder="Next action (e.g. email recruiter)"
        value={nextAction}
        onChange={(e) => setNextAction(e.target.value)}
      />
      <textarea style={field} placeholder="Notes (contact, salary, next step...)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {message && <p role="status">{message}</p>}
      <button onClick={() => void save()} disabled={!role.trim() || saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>{' '}
      {duplicate && (
        <button onClick={() => void save(true)} disabled={saving}>
          Save duplicate anyway
        </button>
      )}{' '}
      <button onClick={openDashboard}>Dashboard</button>
    </div>
  )
}
