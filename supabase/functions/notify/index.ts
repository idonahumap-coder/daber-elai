import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { once, sendTo } from './push.ts'

const TZ = 'Asia/Jerusalem'
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function il(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  const hh = p.hour === '24' ? '00' : p.hour
  return { date: `${p.year}-${p.month}-${p.day}`, min: +hh * 60 + +p.minute, dow: wd }
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const addDays = (s: string, n: number) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
/** epoch ms of an Israel local date+time */
function ilEpoch(date: string, time: string) {
  const guess = new Date(`${date}T${time.slice(0, 5)}:00Z`).getTime()
  const loc = il(new Date(guess))
  const diff = (toMin(time) - loc.min) + (loc.date === date ? 0 : loc.date < date ? 1440 : -1440)
  return guess + diff * 60000
}
const within = (now: number, at: number, win = 10) => now >= at && now < at + win

interface Prof { id: string; display_name: string; day_start: string; day_end: string; shabbat_mode: boolean; notif_prefs: Record<string, boolean>; learning_enabled: boolean; is_admin: boolean }
interface Task { id: string; owner_id: string; assignee_id: string | null; household_id: string | null; title: string; kind: string; due_date: string; due_time: string | null; status: string; reminder_min: number | null; reminded_at: string | null; overdue_notified_at: string | null; done_at: string | null; postpone_count: number; world: string; created_at: string }

async function stats(admin: SupabaseClient, uid: string, from: string, to: string) {
  const { data } = await admin.from('tasks').select('id,status,due_date,kind,done_at,postpone_count,title,world').or(`owner_id.eq.${uid},assignee_id.eq.${uid}`).gte('due_date', from).lte('due_date', to).neq('status', 'cancelled')
  const all = (data || []) as Task[]
  const done = all.filter((t) => t.status === 'done')
  const { count: postponed } = await admin.from('task_events').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('type', 'postponed').gte('at', from).lte('at', to + 'T23:59:59')
  const { count: cancelled } = await admin.from('task_events').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('type', 'cancelled').gte('at', from).lte('at', to + 'T23:59:59')
  const byDay: Record<number, { t: number; d: number }> = {}
  for (const t of all) { const w = new Date(t.due_date + 'T12:00:00Z').getUTCDay(); byDay[w] ??= { t: 0, d: 0 }; byDay[w].t++; if (t.status === 'done') byDay[w].d++ }
  return { total: all.length, done: done.length, pct: all.length ? Math.round((done.length / all.length) * 100) : 0, postponed: postponed ?? 0, cancelled: cancelled ?? 0, byDay, open: all.filter((t) => t.status === 'open') }
}

async function learn(admin: SupabaseClient, uid: string, today: string) {
  const s = await stats(admin, uid, addDays(today, -56), today)
  const facts: { key: string; text: string }[] = []
  const days = Object.entries(s.byDay).filter(([, v]) => v.t >= 3).map(([k, v]) => ({ k: +k, r: v.d / v.t }))
  if (days.length >= 3) {
    days.sort((a, b) => b.r - a.r)
    facts.push({ key: 'strong_day', text: `ביום ${DAYS[days[0].k]} אתה הכי אפקטיבי (${Math.round(days[0].r * 100)}% ביצוע).` })
    const w = days[days.length - 1]
    if (w.r < 0.7) facts.push({ key: 'weak_day', text: `ביום ${DAYS[w.k]} אתה משלים רק ${Math.round(w.r * 100)}% מהמשימות. כדאי להעמיס עליו פחות.` })
  }
  const { data: ev } = await admin.from('task_events').select('at').eq('user_id', uid).eq('type', 'done').gte('at', addDays(today, -42))
  if ((ev || []).length >= 10) {
    const hours = Array(24).fill(0)
    for (const e of ev!) { const h = Math.floor(il(new Date(e.at)).min / 60); hours[h]++ }
    let best = 0, bh = 0
    for (let h = 0; h < 22; h++) { const s3 = hours[h] + hours[h + 1] + hours[h + 2]; if (s3 > best) { best = s3; bh = h } }
    facts.push({ key: 'peak_hours', text: `רוב המשימות שאתה מסיים, אתה מסיים בין ${bh}:00 ל-${bh + 3}:00.` })
  }
  if (s.total >= 10 && s.cancelled / Math.max(1, s.total) > 0.15) facts.push({ key: 'cancel_rate', text: `אתה מבטל בערך ${Math.round((s.cancelled / s.total) * 100)}% מהמשימות. אולי חלק מהן לא באמת הכרחיות כשאתה רושם אותן.` })
  const { data: post } = await admin.from('tasks').select('title,postpone_count').eq('owner_id', uid).gte('postpone_count', 3).order('postpone_count', { ascending: false }).limit(1)
  if (post?.[0]) facts.push({ key: 'most_postponed', text: `"${post[0].title}" היא המשימה שאתה הכי דוחה (${post[0].postpone_count} פעמים).` })
  const added: string[] = []
  for (const f of facts) {
    const { data: ex } = await admin.from('learned_facts').select('text').eq('user_id', uid).eq('key', f.key).maybeSingle()
    if (ex?.text === f.text) continue
    await admin.from('learned_facts').upsert({ user_id: uid, key: f.key, text: f.text, source: 'auto', created_at: new Date().toISOString() }, { onConflict: 'user_id,key' })
    added.push(f.text)
  }
  return added
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: sec } = await admin.from('app_secrets').select('value').eq('key', 'cron').single()
  if (!sec || req.headers.get('x-cron-secret') !== sec.value) return new Response('forbidden', { status: 403 })

  const now = Date.now()
  const L = il()
  const log: string[] = []

  // materialize recurring tasks for today
  try { await admin.rpc('materialize_series', { p_date: L.date }) } catch { /* */ }

  const { data: subsUsers } = await admin.from('push_subscriptions').select('user_id')
  const withSubs = new Set((subsUsers || []).map((r: { user_id: string }) => r.user_id))
  const { data: profs } = await admin.from('profiles').select('id,display_name,day_start,day_end,shabbat_mode,notif_prefs,learning_enabled,is_admin').eq('status', 'approved')
  const people = (profs || []) as Prof[]
  const byId = new Map(people.map((p) => [p.id, p]))
  const pref = (p: Prof, k: string) => p.notif_prefs?.[k] !== false
  const quiet = (p: Prof) => p.shabbat_mode && ((L.dow === 5 && L.min >= 13 * 60) || (L.dow === 6 && L.min < 19 * 60))

  // ---- task reminders & overdue (all users) ----
  const { data: tasks } = await admin.from('tasks').select('*').eq('status', 'open').eq('kind', 'timed').gte('due_date', addDays(L.date, -1)).lte('due_date', addDays(L.date, 1))
  const { data: mems } = await admin.from('task_members').select('task_id,user_id').eq('status', 'accepted')
  const memMap = new Map<string, string[]>()
  for (const m of mems || []) { const a = memMap.get(m.task_id) || []; a.push(m.user_id); memMap.set(m.task_id, a) }
  for (const t of (tasks || []) as Task[]) {
    if (!t.due_time) continue
    const due = ilEpoch(t.due_date, t.due_time)
    const recips = [...new Set([t.owner_id, ...(t.assignee_id ? [t.assignee_id] : []), ...(memMap.get(t.id) || [])])]
    const owner = byId.get(t.owner_id)
    const remMin = t.reminder_min ?? 15
    if (!t.reminded_at && now >= due - remMin * 60000 && now < due + 5 * 60000) {
      await admin.from('tasks').update({ reminded_at: new Date().toISOString() }).eq('id', t.id)
      for (const uid of recips) {
        const p = byId.get(uid); if (!p || !withSubs.has(uid) || quiet(p) || !pref(p, 'reminder')) continue
        await sendTo(admin, uid, { title: remMin && now < due - 60000 ? `⏰ תזכורת · ${t.due_time.slice(0, 5)} · בעוד ${Math.max(1, Math.round((due - now) / 60000))} דק׳` : `⏰ הגיע הזמן · ${t.due_time.slice(0, 5)}`, body: `מזכיר: ${t.title}`, url: './#/', tag: 'rem-' + t.id })
        log.push('rem ' + t.id)
      }
    } else if (!t.overdue_notified_at && now >= due + 10 * 60000 && now < due + 3 * 3600000) {
      await admin.from('tasks').update({ overdue_notified_at: new Date().toISOString() }).eq('id', t.id)
      for (const uid of recips) {
        const p = byId.get(uid); if (!p || !withSubs.has(uid) || quiet(p) || !pref(p, 'overdue')) continue
        await sendTo(admin, uid, { title: `עדיין לא סומן כבוצע · ${t.due_time.slice(0, 5)}`, body: `מזכיר: ${t.title}`, url: './#/', tag: 'late-' + t.id })
        log.push('late ' + t.id)
      }
    }
    void owner
  }

  // ---- idea reminders ----
  const { data: ideas } = await admin.from('ideas').select('id,owner_id,title,remind_at').eq('reminded', false).eq('status', 'open').not('remind_at', 'is', null).lte('remind_at', new Date().toISOString())
  for (const i of ideas || []) {
    await admin.from('ideas').update({ reminded: true }).eq('id', i.id)
    const p = byId.get(i.owner_id); if (!p || !withSubs.has(p.id) || quiet(p) || !pref(p, 'idea')) continue
    await sendTo(admin, p.id, { title: 'זמן לחזור לרעיון', body: i.title, url: './#/ideas' })
  }

  // ---- admin: new pending users ----
  const { data: pend } = await admin.from('profiles').select('id,display_name,email').eq('status', 'pending')
  for (const u of pend || []) for (const a of people.filter((p) => p.is_admin)) {
    if (await once(admin, a.id, 'pending', u.id)) await sendTo(admin, a.id, { title: 'משתמש חדש מחכה לאישור', body: `${u.display_name} (${u.email})`, url: './#/admin' })
  }

  // ---- per-user daily rhythm ----
  for (const p of people) {
    if (!withSubs.has(p.id) || quiet(p)) continue
    const ds = toMin(p.day_start), de = toMin(p.day_end)

    // morning (not on Saturday)
    if (L.dow !== 6 && pref(p, 'morning') && within(L.min, ds) && await once(admin, p.id, 'morning', L.date)) {
      const { data: tt } = await admin.from('tasks').select('id,kind,due_date,due_time,status').or(`owner_id.eq.${p.id},assignee_id.eq.${p.id}`).eq('status', 'open').lte('due_date', L.date)
      const today = (tt || []).filter((t: Task) => t.due_date === L.date)
      const late = (tt || []).filter((t: Task) => t.due_date < L.date && (t.kind === 'day' || t.kind === 'timed'))
      const timed = today.filter((t: Task) => t.kind === 'timed').length
      const parts = [`היום ${today.length} משימות`]
      if (timed) parts.push(`${timed} בשעה מסוימת`)
      if (late.length) parts.push(`${late.length} באיחור`)
      await sendTo(admin, p.id, { title: `בוקר טוב${p.display_name ? ' ' + p.display_name.split(' ')[0] : ''}!`, body: today.length || late.length ? parts.join(', ') + '. בוא תראה.' : 'אין משימות להיום. רוצה להוסיף משהו?', url: './#/' })
      log.push('morning ' + p.id)
    }

    // weekly repeat on Sunday morning
    if (L.dow === 0 && pref(p, 'weekly') && within(L.min, ds + 15) && await once(admin, p.id, 'weekly-sun', L.date)) {
      const { data: sm } = await admin.from('summaries').select('text').eq('user_id', p.id).eq('kind', 'weekly').order('period_start', { ascending: false }).limit(1).maybeSingle()
      if (sm?.text) await sendTo(admin, p.id, { title: 'הסיכום השבועי שלך', body: sm.text.split('\n')[0], url: './#/insights' })
    }

    // monthly on the 1st
    if (L.date.endsWith('-01') && pref(p, 'monthly') && within(L.min, ds + 30) && await once(admin, p.id, 'monthly', L.date)) {
      const prevEnd = addDays(L.date, -1), prevStart = prevEnd.slice(0, 8) + '01'
      const s = await stats(admin, p.id, prevStart, prevEnd)
      const text = `בחודש שעבר השלמת ${s.done} מתוך ${s.total} משימות (${s.pct}%).\nדחית ${s.postponed} פעמים וביטלת ${s.cancelled} משימות.`
      await admin.from('summaries').upsert({ user_id: p.id, kind: 'monthly', period_start: prevStart, data: s, text }, { onConflict: 'user_id,kind,period_start' })
      await sendTo(admin, p.id, { title: 'סיכום חודשי', body: text.replace('\n', ' '), url: './#/insights' })
    }

    // evening (not Friday)
    if (L.dow !== 5 && pref(p, 'evening') && within(L.min, de) && await once(admin, p.id, 'evening', L.date)) {
      const s = await stats(admin, p.id, L.date, L.date)
      const left = s.open.length
      const text = s.total ? `היום השלמת ${s.done} מתוך ${s.total} (${s.pct}%).${left ? ` ${left} נשארו פתוחות. בוא נעביר אותן למחר.` : ' סגרת הכל!'}` : 'יום בלי משימות. רוצה לתכנן את מחר?'
      await admin.from('summaries').upsert({ user_id: p.id, kind: 'daily', period_start: L.date, data: { total: s.total, done: s.done }, text }, { onConflict: 'user_id,kind,period_start' })
      await sendTo(admin, p.id, { title: 'סיכום היום', body: text, url: './#/' })
      log.push('evening ' + p.id)
    }

    // weekly on Thursday evening
    if (L.dow === 4 && pref(p, 'weekly') && within(L.min, de + 30) && await once(admin, p.id, 'weekly', L.date)) {
      const ws = addDays(L.date, -4)
      const s = await stats(admin, p.id, ws, L.date)
      const learned = p.learning_enabled ? await learn(admin, p.id, L.date) : []
      const best = Object.entries(s.byDay).filter(([, v]) => v.t >= 2).sort((a, b) => b[1].d / b[1].t - a[1].d / a[1].t)[0]
      let text = `השבוע השלמת ${s.done} מתוך ${s.total} משימות (${s.pct}%).`
      if (best) text += `\nהיום הכי חזק: ${DAYS[+best[0]]}.`
      if (s.postponed) text += `\nדחית ${s.postponed} פעמים.`
      if (learned.length) text += `\nמה למדתי עליך: ${learned[0]}`
      await admin.from('summaries').upsert({ user_id: p.id, kind: 'weekly', period_start: ws, data: { total: s.total, done: s.done, postponed: s.postponed }, text }, { onConflict: 'user_id,kind,period_start' })
      await sendTo(admin, p.id, { title: 'הסיכום השבועי שלך', body: text.split('\n').slice(0, 2).join(' '), url: './#/insights' })
    }
  }

  return new Response(JSON.stringify({ ok: true, at: L, log }), { headers: { 'Content-Type': 'application/json' } })
})
