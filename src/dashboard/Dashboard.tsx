import { useEffect, useMemo, useState } from 'react'
import {
  getApplications,
  updateApplication,
  deleteApplication,
} from '../shared/storage'
import { downloadCsv } from '../shared/export'
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

export default function Dashboard() {
  const [apps, setApps] = useState<Application[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [month, setMonth] = useState('all') // 'all' or 'YYYY-MM'

  useEffect(() => {
    const load = () => getApplications().then(setApps)
    load()
    chrome.storage.onChanged.addListener(load)
    return () => chrome.storage.onChanged.removeListener(load)
  }, [])

  const months = useMemo(
    () =>
      Array.from(new Set(apps.map((a) => a.dateApplied.slice(0, 7)))).sort().reverse(),
    [apps]
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps
      .filter((a) => month === 'all' || a.dateApplied.startsWith(month))
      .filter((a) => filter === 'all' || a.status === filter)
      .filter(
        (a) =>
          !q ||
          `${a.role} ${a.company} ${a.source} ${a.notes}`.toLowerCase().includes(q)
      )
      .sort((a, b) => b.dateApplied.localeCompare(a.dateApplied))
  }, [apps, query, filter, month])

  function remove(id: string) {
    if (confirm('Delete this application?')) deleteApplication(id)
  }

  const periodLabel = month === 'all' ? 'All dates' : month

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <style>{printCss}</style>
      <h1>Job applications</h1>
      <p>
        Period: {periodLabel} · {visible.length} application{visible.length === 1 ? '' : 's'}
      </p>

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
        <button onClick={() => downloadCsv(visible, `job-applications-${month}.csv`)}>
          Export CSV
        </button>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      {visible.length === 0 ? (
        <p>No applications to show. Open a job page and click the extension icon to save one.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={cell}>Date</th>
              <th style={cell}>Role</th>
              <th style={cell}>Company</th>
              <th style={cell}>Source</th>
              <th style={cell}>Status</th>
              <th style={cell}>Notes</th>
              <th style={cell} className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id}>
                <td style={cell}>{a.dateApplied}</td>
                <td style={cell}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.role}
                  </a>
                  <div className="print-only" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                    {a.url}
                  </div>
                </td>
                <td style={cell}>
                  <input
                    defaultValue={a.company}
                    onBlur={(e) => updateApplication(a.id, { company: e.target.value })}
                  />
                </td>
                <td style={cell}>{a.source}</td>
                <td style={cell}>
                  <select
                    value={a.status}
                    onChange={(e) =>
                      updateApplication(a.id, { status: e.target.value as Status })
                    }
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={cell}>
                  <textarea
                    defaultValue={a.notes}
                    rows={2}
                    onBlur={(e) => updateApplication(a.id, { notes: e.target.value })}
                  />
                </td>
                <td style={cell} className="no-print">
                  <button onClick={() => remove(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}