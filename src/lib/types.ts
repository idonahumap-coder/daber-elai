export type World = 'personal' | 'home' | 'work'
export type Kind = 'timed' | 'day' | 'week' | 'deadline'
export type Status = 'open' | 'done' | 'cancelled'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  is_admin: boolean
  ai_enabled: boolean
  ai_daily_limit: number
  delete_requested: boolean
  onboarded: boolean
  day_start: string
  day_end: string
  worlds: World[]
  shopping_worlds: World[]
  action_mode: 'swipe' | 'buttons'
  record_mode: 'toggle' | 'hold'
  shabbat_mode: boolean
  default_reminder_min: number
  learning_enabled: boolean
  theme: 'auto' | 'dark' | 'light'
  notif_prefs: Record<string, boolean>
}

export interface Task {
  id: string
  owner_id: string
  household_id: string | null
  assignee_id: string | null
  world: World
  title: string
  notes: string | null
  kind: Kind
  due_date: string | null
  due_time: string | null
  priority: number
  reminder_min: number | null
  series_id: string | null
  status: Status
  done_at: string | null
  done_by: string | null
  cancelled_at: string | null
  postpone_count: number
  source: string
  created_at: string
  updated_at: string
}

export interface Series {
  id: string
  owner_id: string
  household_id: string | null
  world: World
  title: string
  notes: string | null
  priority: number
  due_time: string | null
  reminder_min: number | null
  rule: { type: 'daily' | 'weekdays' | 'monthly' | 'interval'; days?: number[]; day?: number; every?: number; start?: string }
  active: boolean
}

export interface Idea {
  id: string
  owner_id: string
  title: string
  body: string | null
  category_id: string | null
  remind_at: string | null
  deadline: string | null
  status: 'open' | 'converted' | 'archived'
  task_id: string | null
  created_at: string
}

export interface Category { id: string; owner_id: string; name: string }

export interface ShopItem {
  id: string
  owner_id: string | null
  household_id: string | null
  name: string
  qty: string | null
  checked: boolean
  checked_at: string | null
  created_by: string | null
  created_at: string
}

export interface Person { id: string; display_name: string | null; avatar_url: string | null; status?: string }

export interface Membership { task_id: string; user_id: string; role: 'shared' | 'assignee'; status: 'pending' | 'accepted' | 'declined'; invited_by: string | null }

export interface Extracted {
  type: 'task' | 'idea' | 'shopping'
  title: string
  world: World
  kind?: Kind
  date?: string | null
  time?: string | null
  priority?: number
  recurrence?: Series['rule'] | null
  qty?: string | null
  category?: string | null
  question?: string | null
  quote?: string | null
}
