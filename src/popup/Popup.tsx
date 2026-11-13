import { useEffect, useState } from 'react'
import { addApplication } from '../shared/storage'
import type { Status } from '../shared/types'

const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD, local time

const field: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 6,
  marginBottom: 8,
}

export default function Popup() {
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('applied')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setRole(tab?.title ?? '')
      setUrl(tab?.url ?? '')
    })
  }, [])

  async function save() {
    let source = ''
    try {
      source = new URL(url).hostname.replace('www.', '')
    } catch {
      source = ''
    }
    await addApplication({
      id: crypto.randomUUID(),
      role,
      company,
      url,
      source,
      status,
      dateApplied: date,
      notes,
    })
    setSaved(true)
  }

  function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
  }

  if (saved) {
    return (
      <div style={{ padding: 12 }}>
        <h3>Saved ✅</h3>
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
      <input style={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <textarea style={field} placeholder="Notes (contact, salary, next step...)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button onClick={save} disabled={!role.trim()}>Save</button>{' '}
      <button onClick={openDashboard}>Dashboard</button>
    </div>
  )
}