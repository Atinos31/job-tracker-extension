import type { Application } from './types'

export function getGmailSearchUrl(app: Application): string | undefined {
  const terms = [app.company, app.role]
    .map((value) => value.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const uniqueTerms = [...new Set(terms.map((value) => `"${value}"`))]
  if (uniqueTerms.length === 0) return undefined

  const search = uniqueTerms.length === 1 ? uniqueTerms[0] : `{${uniqueTerms.join(' ')}}`
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(search)}`
}
