import type { Application } from './types'

const KEY = 'applications'

export async function getApplications(): Promise<Application[]> {
  const result = await chrome.storage.local.get(KEY)
  return (result[KEY] as Application[] | undefined) ?? []
}

export async function addApplication(app: Application): Promise<void> {
  const all = await getApplications()
  await chrome.storage.local.set({ [KEY]: [app, ...all] })
}