import type { Profile, Task, World } from './types'

export const WORLD_LABEL: Record<World, string> = { personal: 'אישי', home: 'בית', work: 'עבודה' }
export const PRIORITY_LABEL = ['נמוכה', 'רגילה', 'גבוהה', 'גבוהה מאוד']
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const MONTHS = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר']

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const today = () => ymd(new Date())
export const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d) }
export const dow = (s: string) => parseYmd(s).getDay()
export const weekStart = (s: string) => addDays(s, -dow(s))
export const weekFriday = (s: string) => addDays(weekStart(s), 5)
export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const fromMinutes = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`

export function hebDate(s: string, withDay = true) {
  const d = parseYmd(s)
  return `${withDay ? `יום ${DAY_NAMES[d.getDay()]}, ` : ''}${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function relDay(s: string) {
  const t = today()
  if (s === t) return 'היום'
  if (s === addDays(t, 1)) return 'מחר'
  if (s === addDays(t, -1)) return 'אתמול'
  const diff = Math.round((parseYmd(s).getTime() - parseYmd(t).getTime()) / 86400000)
  if (diff > 1 && diff < 7) return `יום ${DAY_NAMES[dow(s)]}`
  return hebDate(s, false)
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'לילה טוב.'
  if (h < 12) return 'בוקר טוב.'
  if (h < 17) return 'צהריים טובים.'
  if (h < 21) return 'ערב טוב.'
  return 'לילה טוב.'
}

/** When a task is considered late */
export function deadlineOf(t: Task, p: Profile | null): Date | null {
  if (!t.due_date) return null
  const d = parseYmd(t.due_date)
  if (t.kind === 'timed' && t.due_time) {
    const [h, m] = t.due_time.split(':').map(Number); d.setHours(h, m, 0, 0); return d
  }
  if (t.kind === 'week') { const f = parseYmd(weekFriday(t.due_date)); f.setHours(23, 59, 0, 0); return f }
  if (t.kind === 'deadline') { d.setHours(23, 59, 0, 0); return d }
  const end = p?.day_end ?? '20:00'
  const [h, m] = end.split(':').map(Number); d.setHours(h, m, 0, 0); return d
}

export function isOverdue(t: Task, p: Profile | null, now = new Date()) {
  if (t.status !== 'open') return false
  const dl = deadlineOf(t, p)
  return !!dl && dl.getTime() < now.getTime()
}

export function taskMeta(t: Task) {
  const parts: string[] = []
  if (t.kind === 'timed' && t.due_time) parts.push(t.due_date && t.due_date !== today() ? `${relDay(t.due_date)} · ${hm(t.due_time)}` : hm(t.due_time))
  else if (t.kind === 'day') parts.push(t.due_date && t.due_date !== today() ? relDay(t.due_date) : 'במהלך היום')
  else if (t.kind === 'week') parts.push('השבוע')
  else if (t.kind === 'deadline' && t.due_date) parts.push(`עד ${relDay(t.due_date)}`)
  if (t.priority >= 2) parts.push(`עדיפות ${PRIORITY_LABEL[t.priority]}`)
  return parts.join(' · ')
}

export function inDays(n: number, base = today()) { return addDays(base, n) }
