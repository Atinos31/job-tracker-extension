import type { Application } from './types'

const KEY = 'applications'

export async function getApplications(): Promise<Application[]> {
  const result = await chrome.storage.local.get(KEY)
  return (result[KEY] as Application[] | undefined) ?? []
}

async function saveAll(all: Application[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: all })
}

export async function addApplication(app: Application): Promise<void> {
  const all = await getApplications()
  await saveAll([app, ...all])
}

export async function updateApplication(
  id: string,
  changes: Partial<Application>
): Promise<void> {
  const all = await getApplications()
  await saveAll(all.map((a) => (a.id === id ? { ...a, ...changes } : a)))
}

export async function deleteApplication(id: string): Promise<void> {
  const all = await getApplications()
  await saveAll(all.filter((a) => a.id !== id))
}