import type { Application } from './types'
import { STATUS_LABELS } from './types'

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`

export function downloadCsv(apps: Application[], filename: string) {
  const header = ['Date', 'Role', 'Company', 'Source', 'Status', 'URL', 'Notes']
  const rows = apps.map((a) =>
    [a.dateApplied, a.role, a.company, a.source, STATUS_LABELS[a.status], a.url, a.notes]
      .map(esc)
      .join(';')
  )
  // The BOM keeps accents correct in Excel; ";" is the separator Belgian Excel expects
  const csv = '\uFEFF' + [header.map(esc).join(';'), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}