import type { Application } from './types'
import { STATUS_LABELS } from './types'

const KEY = 'applications'
const VALID_STATUSES = Object.keys(STATUS_LABELS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStatus(value: unknown): value is Application['status'] {
  return typeof value === 'string' && VALID_STATUSES.includes(value)
}

function normalizeApplication(value: unknown): Application {
  if (!isRecord(value)) throw new Error('An application record is not an object.')

  const { id, role, company, url, source, status, dateApplied, notes } = value
  if (
    typeof id !== 'string' ||
    typeof role !== 'string' ||
    typeof company !== 'string' ||
    typeof url !== 'string' ||
    typeof source !== 'string' ||
    !isStatus(status) ||
    (typeof dateApplied !== 'string' && dateApplied !== null && dateApplied !== undefined) ||
    typeof notes !== 'string'
  ) {
    throw new Error('An application record contains invalid fields.')
  }

  const legacyDate = typeof dateApplied === 'string' ? dateApplied : ''
  if (value.dateSaved !== undefined && typeof value.dateSaved !== 'string') {
    throw new Error('An application record has an invalid saved date.')
  }
  if (value.followUpDate !== undefined && typeof value.followUpDate !== 'string') {
    throw new Error('An application record has an invalid follow-up date.')
  }
  if (value.nextAction !== undefined && typeof value.nextAction !== 'string') {
    throw new Error('An application record has an invalid next action.')
  }
  const dateSaved =
    typeof value.dateSaved === 'string'
      ? value.dateSaved
      : legacyDate || new Date().toLocaleDateString('sv-SE')
  const appliedDate =
    typeof value.dateSaved === 'string'
      ? typeof dateApplied === 'string'
        ? dateApplied
        : null
      : status === 'saved'
        ? null
        : legacyDate || null
  const statusHistory =
    value.statusHistory === undefined
      ? []
      : Array.isArray(value.statusHistory)
        ? value.statusHistory.map((entry) => {
            if (
              !isRecord(entry) ||
              !isStatus(entry.status) ||
              typeof entry.changedAt !== 'string'
            ) {
              throw new Error('An application record has invalid status history.')
            }
            return { status: entry.status, changedAt: entry.changedAt }
          })
        : (() => {
            throw new Error('An application record has invalid status history.')
          })()

  return {
    id,
    role,
    company,
    url,
    source,
    status,
    dateSaved,
    dateApplied: appliedDate,
    followUpDate: typeof value.followUpDate === 'string' ? value.followUpDate : '',
    nextAction: typeof value.nextAction === 'string' ? value.nextAction : '',
    notes,
    statusHistory,
  }
}

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase()
      if (
        normalizedKey.startsWith('utm_') ||
        ['fbclid', 'gclid', 'msclkid', 'ref', 'referrer'].includes(normalizedKey)
      ) {
        parsed.searchParams.delete(key)
      }
    }
    parsed.searchParams.sort()
    return parsed.href.replace(/\/$/, '')
  } catch {
    return url.trim().toLowerCase()
  }
}

export async function getApplications(): Promise<Application[]> {
  const result = await chrome.storage.local.get(KEY)
  const stored: unknown = result[KEY] ?? []
  if (!Array.isArray(stored)) throw new Error('Saved applications data is not a list.')
  return stored.map(normalizeApplication)
}

async function saveAll(all: Application[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: all })
}

export async function addApplication(
  app: Application,
  allowDuplicate = false
): Promise<Application | undefined> {
  const all = await getApplications()
  if (!allowDuplicate) {
    const key = canonicalUrl(app.url)
    const duplicate = all.find((existing) => key && canonicalUrl(existing.url) === key)
    if (duplicate) return duplicate
  }
  await saveAll([app, ...all])
  return undefined
}

export async function updateApplication(
  id: string,
  changes: Partial<Application>
): Promise<void> {
  const all = await getApplications()
  await saveAll(
    all.map((app) => {
      if (app.id !== id) return app
      const updated = { ...app, ...changes }
      if (changes.status && changes.status !== app.status) {
        updated.statusHistory = [
          ...app.statusHistory,
          { status: changes.status, changedAt: new Date().toISOString() },
        ]
        if (changes.status !== 'saved' && !app.dateApplied) {
          updated.dateApplied = new Date().toLocaleDateString('sv-SE')
        }
      }
      return updated
    })
  )
}

export async function deleteApplication(id: string): Promise<void> {
  const all = await getApplications()
  await saveAll(all.filter((a) => a.id !== id))
}

export async function importApplications(json: string): Promise<number> {
  const parsed: unknown = JSON.parse(json)
  if (isRecord(parsed) && parsed.version !== undefined && parsed.version !== 1) {
    throw new Error('This backup version is not supported.')
  }
  const records = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.applications)
      ? parsed.applications
      : undefined
  if (!records) {
    throw new Error('Backup must contain an applications list.')
  }

  const imported = records.map(normalizeApplication)
  const all = await getApplications()
  const ids = new Set(all.map((app) => app.id))
  const urls = new Set(all.map((app) => canonicalUrl(app.url)).filter(Boolean))
  const additions: Application[] = []

  for (const app of imported) {
    const url = canonicalUrl(app.url)
    if (ids.has(app.id) || (url && urls.has(url))) continue
    ids.add(app.id)
    if (url) urls.add(url)
    additions.push(app)
  }

  if (additions.length) await saveAll([...additions, ...all])
  return additions.length
}