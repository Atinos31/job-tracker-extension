import { useEffect, useMemo, useState } from 'react'
import {
  getApplications,
  updateApplication,
  deleteApplication,
} from '../shared/storage'
import { STATUS_LABELS } from '../shared/types'
import type { Application, Status } from '../shared/types'

const cell: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #ddd',
  textAlign: 'left',
  verticalAlign: 'top',
}

export default function Dashboard() {
  const [apps, setApps] = useState<Application[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Status | 'all'>('all')

  useEffect(() => {
    const load = () => getApplications().then(setApps)
    load()
    chrome.storage.onChanged.addListener(load)
    return () => chrome.storage.onChanged.removeListener(load)
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps
      .filter((a) => filter === 'all' || a.status === filter)
      .filter(
        (a) =>
          !q ||
          `${a.role} ${a.company} ${a.source} ${a.notes}`.toLowerCase().includes(q)
      )
      .sort((a, b) => b.dateApplied.localeCompare(a.dateApplied))
  }, [apps, query, filter])

  function remove(id: string) {
    if (confirm('Delete this application?')) deleteApplication(id)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>Job Tracker</h1>
      <p>
        {apps.length} application{apps.length === 1 ? '' : 's'} saved
        {visible.length !== apps.length && ` · ${visible.length} shown`}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          placeholder="Search role, company, notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
      </div>

      {visible.length === 0 ? (
        <p>No applications yet. Open a job page and click the extension icon to save one.</p>
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
              <th style={cell}></th>
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
                <td style={cell}>
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