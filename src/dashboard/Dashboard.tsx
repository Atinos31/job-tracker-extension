import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteApplication,
  getApplications,
  importApplications,
  updateApplication,
} from '../shared/storage'
import { downloadBackup, downloadCsv } from '../shared/export'
import { getGmailSearchUrl } from '../shared/gmail'
import { STATUS_LABELS } from '../shared/types'
import type { Application, Status } from '../shared/types'

const cell: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #ddd',
  textAlign: 'left',
  verticalAlign: 'top',
}

const printCss = `
  .print-only { display: none; }
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block; }
    input, textarea, select { border: none; background: none; font: inherit; }
  }
`

const today = () => new Date().toLocaleDateString('sv-SE')

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

export default function Dashboard() {
  const [apps, setApps] = useState<Application[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [month, setMonth] = useState('all')
  const [followUpsOnly, setFollowUpsOnly] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    const load = () => {
      getApplications()
        .then((applications) => {
          if (active) {
            setApps(applications)
            setError('')
          }
        })
        .catch((reason: unknown) => {
          if (active) setError(`Could not load applications: ${getErrorMessage(reason)}`)
        })
    }

    load()
    const onChanged = () => load()
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      active = false
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  const months = useMemo(
    () =>
      Array.from(new Set(apps.map((app) => app.dateSaved.slice(0, 7)).filter(Boolean)))
        .sort()
        .reverse(),
    [apps]
  )

  const dueApplications = useMemo(() => {
    const lastUpcomingDate = new Date()
    lastUpcomingDate.setDate(lastUpcomingDate.getDate() + 7)
    const throughDate = lastUpcomingDate.toLocaleDateString('sv-SE')
    return apps
      .filter(
        (app) =>
          app.followUpDate &&
          app.followUpDate <= throughDate &&
          !['offer', 'rejected', 'no_reply'].includes(app.status)
      )
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
  }, [apps])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps
      .filter((app) => month === 'all' || app.dateSaved.startsWith(month))
      .filter((app) => filter === 'all' || app.status === filter)
      .filter((app) => !followUpsOnly || dueApplications.some((due) => due.id === app.id))
      .filter(
        (app) =>
          !q ||
          `${app.role} ${app.company} ${app.source} ${app.notes} ${app.nextAction}`
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => b.dateSaved.localeCompare(a.dateSaved))
  }, [apps, query, filter, month, followUpsOnly, dueApplications])

  async function update(id: string, changes: Partial<Application>) {
    try {
      await updateApplication(id, changes)
      setError('')
    } catch (reason) {
      setError(`Could not update application: ${getErrorMessage(reason)}`)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this application?')) return
    try {
      await deleteApplication(id)
      setError('')
    } catch (reason) {
      setError(`Could not delete application: ${getErrorMessage(reason)}`)
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    setNotice('')
    try {
      const count = await importApplications(await file.text())
      setNotice(`Imported ${count} new application${count === 1 ? '' : 's'}. Existing records were kept.`)
      setError('')
    } catch (reason) {
      setError(`Could not import backup: ${getErrorMessage(reason)}`)
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function exportCsv() {
    try {
      downloadCsv(visible, `job-applications-${month}.csv`)
      setError('')
    } catch (reason) {
      setError(`Could not export CSV: ${getErrorMessage(reason)}`)
    }
  }

  function exportBackup() {
    try {
      downloadBackup(apps)
      setError('')
    } catch (reason) {
      setError(`Could not create backup: ${getErrorMessage(reason)}`)
    }
  }

  const periodLabel = month === 'all' ? 'All dates' : month

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <style>{printCss}</style>
      <h1>Job applications</h1>
      <p>
        Period: {periodLabel} · {visible.length} application{visible.length === 1 ? '' : 's'}
      </p>
      <section aria-label="Follow-up reminders" style={{ marginBottom: 16 }}>
        <button
          aria-pressed={followUpsOnly}
          onClick={() => setFollowUpsOnly((current) => !current)}
        >
          {followUpsOnly ? 'Show all applications' : `Follow-ups due in 7 days (${dueApplications.length})`}
        </button>
        {dueApplications.length > 0 && (
          <ul>
            {dueApplications.slice(0, 5).map((app) => (
              <li key={app.id}>
                {app.followUpDate < today() ? 'Overdue' : `Due ${app.followUpDate}`}:{' '}
                {app.role} at {app.company || 'company not set'}
                {app.nextAction ? ` — ${app.nextAction}` : ''}
              </li>
            ))}
            {dueApplications.length > 5 && <li>And {dueApplications.length - 5} more…</li>}
          </ul>
        )}
      </section>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, padding: 8, minWidth: 200 }}
          placeholder="Search role, company, notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select style={{ padding: 8 }} value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          style={{ padding: 8 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value as Status | 'all')}
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button onClick={exportCsv}>Export CSV</button>
        <button onClick={exportBackup}>Download backup</button>
        <button onClick={() => fileInput.current?.click()}>Import backup</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => void importBackup(event.target.files?.[0])}
        />
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {visible.length === 0 ? (
        <p>
          {apps.length === 0
            ? 'No applications yet. Open a job page and click the extension icon to save one.'
            : 'No applications match these filters.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1280, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cell}>Saved</th>
                <th style={cell}>Applied</th>
                <th style={cell}>Role</th>
                <th style={cell}>Company</th>
                <th style={cell}>Source</th>
                <th style={cell}>Status / history</th>
                <th style={cell}>Follow-up</th>
                <th style={cell}>Next action</th>
                <th style={cell}>Notes</th>
                <th style={cell} className="no-print">Email</th>
                <th style={cell} className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((app) => (
                <tr key={app.id}>
                  <td style={cell}>{app.dateSaved}</td>
                  <td style={cell}>{app.dateApplied ?? '—'}</td>
                  <td style={cell}>
                    <a href={app.url} target="_blank" rel="noreferrer">
                      {app.role}
                    </a>
                    <div className="print-only" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                      {app.url}
                    </div>
                  </td>
                  <td style={cell}>
                    <input
                      aria-label={`Company for ${app.role}`}
                      defaultValue={app.company}
                      onBlur={(e) => void update(app.id, { company: e.target.value })}
                    />
                  </td>
                  <td style={cell}>{app.source}</td>
                  <td style={cell}>
                    <select
                      aria-label={`Status for ${app.role}`}
                      value={app.status}
                      onChange={(e) => void update(app.id, { status: e.target.value as Status })}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {app.statusHistory.length > 0 && (
                      <details>
                        <summary>History</summary>
                        <ul>
                          {app.statusHistory.map((change, index) => (
                            <li key={`${change.changedAt}-${index}`}>
                              {STATUS_LABELS[change.status]} ·{' '}
                              {new Date(change.changedAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td style={cell}>
                    <input
                      aria-label={`Follow-up date for ${app.role}`}
                      type="date"
                      value={app.followUpDate}
                      onChange={(e) => void update(app.id, { followUpDate: e.target.value })}
                    />
                  </td>
                  <td style={cell}>
                    <input
                      aria-label={`Next action for ${app.role}`}
                      defaultValue={app.nextAction}
                      onBlur={(e) => void update(app.id, { nextAction: e.target.value })}
                    />
                  </td>
                  <td style={cell}>
                    <textarea
                      aria-label={`Notes for ${app.role}`}
                      defaultValue={app.notes}
                      rows={2}
                      onBlur={(e) => void update(app.id, { notes: e.target.value })}
                    />
                  </td>
                  <td style={cell} className="no-print">
                    {getGmailSearchUrl(app) && (
                      <a
                        href={getGmailSearchUrl(app)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Search Gmail for ${app.role}${app.company ? ` at ${app.company}` : ''}`}
                      >
                        Search Gmail
                      </a>
                    )}
                  </td>
                  <td style={cell} className="no-print">
                    <button onClick={() => void remove(app.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
