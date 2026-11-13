export type Status =
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'no_reply'

export interface Application {
  id: string
  role: string
  company: string
  url: string
  source: string
  status: Status
  dateApplied: string // YYYY-MM-DD
  notes: string
}