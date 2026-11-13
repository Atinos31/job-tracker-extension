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
  dateSaved: string
  dateApplied: string | null
  followUpDate: string
  nextAction: string
  notes: string
  statusHistory: StatusChange[]
}

export interface StatusChange {
  status: Status
  changedAt: string
}

export const STATUS_LABELS: Record<Status, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  no_reply: 'No reply',
}