import { ding } from './sound'
import { useSyncExternalStore } from 'react'
import { get, set } from 'idb-keyval'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Category, Idea, Membership, Person, Profile, Series, ShopItem, Task } from './types'

export interface State {
  ready: boolean
  session: Session | null
  profile: Profile | null
  tasks: Task[]
  series: Series[]
  ideas: Idea[]
  categories: Category[]
  shopping: ShopItem[]
  memberships: Membership[]
  household: { id: string; name: string } | null
  householdPeople: Person[]
  users: Person[]
  online: boolean
  pendingOps: number
  toast: { text: string; undo?: () => void; id: number } | null
}

let state: State = {
  ready: false, session: null, profile: null, tasks: [], series: [], ideas: [], categories: [], shopping: [],
  memberships: [], household: null, householdPeople: [], users: [], online: navigator.onLine, pendingOps: 0, toast: null
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
export const getState = () => state
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  emit()
  if ('tasks' in p || 'ideas' in p || 'shopping' in p || 'profile' in p || 'series' in p || 'categories' in p) persist()
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => sel(state))
}

/* ---------- local cache ---------- */
let persistTimer: number | undefined
function persist() {
  clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    const uid = state.session?.user.id
    if (!uid) return
    const { profile, tasks, series, ideas, categories, shopping, memberships, household, householdPeople, users } = state
    set(`cache:${uid}`, { profile, tasks, series, ideas, categories, shopping, memberships, household, householdPeople, users }).catch(() => {})
  }, 300)
}
export async function loadCache(uid: string) {
  try {
    const c = await get(`cache:${uid}`)
    if (c) setState({ ...c })
  } catch { /* ignore */ }
}

/* ---------- outbox (offline writes) ---------- */
type Op =
  | { kind: 'upsert'; table: string; row: Record<string, unknown> }
  | { kind: 'update'; table: string; id: string; patch: Record<string, unknown> }
  | { kind: 'delete'; table: string; id: string }
  | { kind: 'rpc'; fn: string; args: Record<string, unknown> }

let outbox: Op[] = []
async function saveOutbox() { try { await set('outbox', outbox) } catch { /* */ } setState({ pendingOps: outbox.length }) }
export async function loadOutbox() { try { outbox = (await get('outbox')) || [] } catch { outbox = [] } setState({ pendingOps: outbox.length }) }

async function exec(op: Op) {
  let res
  if (op.kind === 'upsert') res = await supabase.from(op.table).upsert(op.row)
  else if (op.kind === 'update') res = await supabase.from(op.table).update(op.patch).eq('id', op.id)
  else if (op.kind === 'delete') res = await supabase.from(op.table).delete().eq('id', op.id)
  else res = await supabase.rpc(op.fn, op.args)
  if (res.error) throw res.error
  return res
}
const isNetErr = (e: unknown) => !navigator.onLine || (e instanceof TypeError) || String((e as { message?: string })?.message || '').includes('Failed to fetch')

export async function run(op: Op) {
  if (outbox.length || !navigator.onLine) { outbox.push(op); await saveOutbox(); return }
  try { await exec(op) } catch (e) {
    if (isNetErr(e)) { outbox.push(op); await saveOutbox() } else { console.error(e); toast('משהו השתבש בשמירה. נסה שוב.') ; throw e }
  }
}
let flushing = false
export async function flush() {
  if (flushing || !navigator.onLine || !outbox.length) return
  flushing = true
  try {
    while (outbox.length) {
      try { await exec(outbox[0]) } catch (e) { if (isNetErr(e)) break; console.error('drop op', e) }
      outbox.shift(); await saveOutbox()
    }
  } finally { flushing = false }
  if (!outbox.length) refresh()
}

/* ---------- toast ---------- */
let toastTimer: number | undefined
export function toast(text: string, undo?: () => void) {
  clearTimeout(toastTimer)
  setState({ toast: { text, undo, id: Date.now() } })
  toastTimer = window.setTimeout(() => setState({ toast: null }), undo ? 5000 : 3000)
}

/* ---------- fetch ---------- */
let refreshing: Promise<void> | null = null
export function refresh() {
  if (refreshing) return refreshing
  refreshing = doRefresh().finally(() => { refreshing = null })
  return refreshing
}
async function doRefresh() {
  const uid = state.session?.user.id
  if (!uid || !navigator.onLine) return
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).single()
  if (!profile) return
  setState({ profile })
  supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', uid).then(() => {})
  if (profile.status !== 'approved') return
  await supabase.rpc('materialize_mine')
  const since = new Date(Date.now() - 45 * 86400000).toISOString()
  const [tasks, series, ideas, cats, shop, mem, hh, people, users] = await Promise.all([
    supabase.from('tasks').select('*').or(`status.eq.open,updated_at.gte.${since}`).order('due_date', { ascending: true }).limit(1500),
    supabase.from('series').select('*'),
    supabase.from('ideas').select('*').order('created_at', { ascending: false }),
    supabase.from('idea_categories').select('*').order('created_at'),
    supabase.from('shopping_items').select('*').order('created_at'),
    supabase.from('task_members').select('*'),
    supabase.from('households').select('id,name').limit(1),
    supabase.rpc('household_people'),
    supabase.rpc('list_users')
  ])
  setState({
    tasks: tasks.data || [], series: series.data || [], ideas: ideas.data || [], categories: cats.data || [],
    shopping: shop.data || [], memberships: mem.data || [],
    household: hh.data?.[0] || null, householdPeople: people.data || [], users: users.data || [], ready: true
  })
}

/* ---------- realtime ---------- */
let channel: ReturnType<typeof supabase.channel> | null = null
let rtTimer: number | undefined
export function subscribeRealtime() {
  if (channel) return
  const bump = () => { clearTimeout(rtTimer); rtTimer = window.setTimeout(() => refresh(), 600) }
  channel = supabase.channel('db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_members' }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, bump)
    .subscribe()
}
export function unsubscribeRealtime() { if (channel) { supabase.removeChannel(channel); channel = null } }

/* ---------- mutations ---------- */
const uid = () => state.session!.user.id
const nowIso = () => new Date().toISOString()

export async function saveProfile(patch: Partial<Profile>) {
  if (!state.profile) return
  setState({ profile: { ...state.profile, ...patch } })
  await run({ kind: 'update', table: 'profiles', id: state.profile.id, patch })
}

export function newTask(partial: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(), owner_id: uid(), household_id: null, assignee_id: null, world: 'personal', title: '', notes: null,
    kind: 'day', due_date: null, due_time: null, priority: 1, reminder_min: null, series_id: null, status: 'open',
    done_at: null, done_by: null, cancelled_at: null, postpone_count: 0, source: 'manual', created_at: nowIso(), updated_at: nowIso(),
    ...partial
  }
}

function taskRow(t: Task) {
  const { id, owner_id, household_id, assignee_id, world, title, notes, kind, due_date, due_time, priority, reminder_min, series_id, status, postpone_count, source } = t
  return { id, owner_id, household_id, assignee_id, world, title, notes, kind, due_date, due_time, priority, reminder_min, series_id, status, postpone_count, source }
}

export async function addTasks(list: Task[]) {
  list = list.map((t) => ({ ...t, household_id: t.world === 'home' && state.household ? state.household.id : null }))
  setState((s) => ({ tasks: [...s.tasks, ...list] }))
  for (const t of list) await run({ kind: 'upsert', table: 'tasks', row: taskRow(t) })
  for (const t of list) if (t.household_id) pushEvent({ type: 'new', task_id: t.id })
}

export async function updateTask(id: string, patch: Partial<Task>) {
  const cur = state.tasks.find((t) => t.id === id)
  if (!cur) return
  if (patch.world) patch.household_id = patch.world === 'home' && state.household ? state.household.id : null
  setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updated_at: nowIso() } : t)) }))
  const row = taskRow({ ...cur, ...patch } as Task)
  const changed: Record<string, unknown> = {}
  for (const k of Object.keys(patch)) if (k in row) changed[k] = (row as Record<string, unknown>)[k]
  await run({ kind: 'update', table: 'tasks', id, patch: changed })
}

export async function setTaskStatus(id: string, status: Task['status'], opts: { notify?: boolean; silent?: boolean } = {}) {
  if (status === 'done') ding()
  const prev = state.tasks.find((t) => t.id === id)
  if (!prev) return
  const extra: Partial<Task> = status === 'done' ? { done_at: nowIso(), done_by: uid() } : status === 'cancelled' ? { cancelled_at: nowIso() } : { done_at: null, cancelled_at: null }
  setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, ...extra } : t)) }))
  await run({ kind: 'update', table: 'tasks', id, patch: { status } })
  if (status === 'done' && opts.notify) pushEvent({ type: 'done', task_id: id })
  if (!opts.silent) {
    const msg = status === 'done' ? 'בוצע' : status === 'cancelled' ? 'המשימה בוטלה' : 'המשימה הוחזרה'
    toast(msg, () => { setTaskStatus(id, prev.status, { silent: true }) })
  }
}

export async function postponeTask(id: string, to: { due_date: string; due_time?: string | null; kind?: Task['kind'] }) {
  const cur = state.tasks.find((t) => t.id === id)
  if (!cur) return
  const patch: Partial<Task> = { due_date: to.due_date, postpone_count: cur.postpone_count + 1 }
  if (to.kind) patch.kind = to.kind
  if (to.due_time !== undefined) patch.due_time = to.due_time
  await updateTask(id, patch)
  toast('נדחה')
}

export async function deleteTask(id: string) {
  setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  await run({ kind: 'delete', table: 'tasks', id })
}

export async function addSeries(s: Omit<Series, 'id' | 'owner_id' | 'household_id' | 'active'>) {
  const row: Series = { ...s, id: crypto.randomUUID(), owner_id: uid(), household_id: s.world === 'home' && state.household ? state.household.id : null, active: true }
  setState((st) => ({ series: [...st.series, row] }))
  await run({ kind: 'upsert', table: 'series', row: row as unknown as Record<string, unknown> })
  if (navigator.onLine) { await supabase.rpc('materialize_mine'); refresh() }
}
export async function stopSeries(id: string) {
  setState((s) => ({ series: s.series.map((x) => (x.id === id ? { ...x, active: false } : x)) }))
  await run({ kind: 'update', table: 'series', id, patch: { active: false } })
}

/* ideas */
export async function addIdea(i: Partial<Idea>) {
  const row: Idea = { id: crypto.randomUUID(), owner_id: uid(), title: '', body: null, category_id: null, remind_at: null, deadline: null, status: 'open', task_id: null, created_at: nowIso(), ...i }
  setState((s) => ({ ideas: [row, ...s.ideas] }))
  await run({ kind: 'upsert', table: 'ideas', row: row as unknown as Record<string, unknown> })
  return row
}
export async function updateIdea(id: string, patch: Partial<Idea>) {
  setState((s) => ({ ideas: s.ideas.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  await run({ kind: 'update', table: 'ideas', id, patch })
}
export async function deleteIdea(id: string) {
  setState((s) => ({ ideas: s.ideas.filter((x) => x.id !== id) }))
  await run({ kind: 'delete', table: 'ideas', id })
}
export async function addCategory(name: string) {
  const ex = state.categories.find((c) => c.name.trim() === name.trim())
  if (ex) return ex
  const row: Category = { id: crypto.randomUUID(), owner_id: uid(), name: name.trim() }
  setState((s) => ({ categories: [...s.categories, row] }))
  await run({ kind: 'upsert', table: 'idea_categories', row: row as unknown as Record<string, unknown> })
  return row
}
export async function deleteCategory(id: string) {
  setState((s) => ({ categories: s.categories.filter((c) => c.id !== id), ideas: s.ideas.map((i) => (i.category_id === id ? { ...i, category_id: null } : i)) }))
  await run({ kind: 'delete', table: 'idea_categories', id })
}

/* shopping */
export async function addShop(name: string, qty: string | null, shared: boolean) {
  const row: ShopItem = {
    id: crypto.randomUUID(), owner_id: shared ? null : uid(), household_id: shared ? state.household?.id ?? null : null,
    name, qty, checked: false, checked_at: null, created_by: uid(), created_at: nowIso()
  }
  if (shared && !row.household_id) { row.owner_id = uid() }
  setState((s) => ({ shopping: [...s.shopping, row] }))
  await run({ kind: 'upsert', table: 'shopping_items', row: row as unknown as Record<string, unknown> })
}
export async function toggleShop(id: string) {
  const it = state.shopping.find((x) => x.id === id); if (!it) return
  const patch = { checked: !it.checked, checked_at: !it.checked ? nowIso() : null }
  setState((s) => ({ shopping: s.shopping.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  await run({ kind: 'update', table: 'shopping_items', id, patch })
}
export async function clearChecked(ids: string[]) {
  setState((s) => ({ shopping: s.shopping.filter((x) => !ids.includes(x.id)) }))
  for (const id of ids) await run({ kind: 'delete', table: 'shopping_items', id })
}

/* sharing */
export async function shareTask(taskId: string, userId: string, role: 'shared' | 'assignee') {
  await supabase.rpc('share_task', { p_task: taskId, p_user: userId, p_role: role })
  pushEvent({ type: 'share', task_id: taskId, user_id: userId, role })
  toast(role === 'assignee' ? 'נשלח לאישור' : 'השיתוף נשלח לאישור')
  refresh()
}
export async function respondTasks(ids: string[], accept: boolean) {
  setState((s) => ({ memberships: s.memberships.map((m) => (ids.includes(m.task_id) && m.user_id === uid() ? { ...m, status: accept ? 'accepted' : 'declined' } : m)) }))
  await supabase.rpc('respond_tasks', { p_tasks: ids, p_accept: accept })
  refresh()
}

export async function pushEvent(body: Record<string, unknown>) {
  try { await supabase.functions.invoke('push-event', { body }) } catch { /* best effort */ }
}
