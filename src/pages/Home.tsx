import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addTasks, getState, newTask, refresh, respondTasks, setTaskStatus, toast, updateTask, useStore } from '../lib/store'
import { setUI, useUI } from '../lib/ui'
import { DAY_NAMES, ymd, addDays, deadlineOf, greeting, hebDate, isOverdue, minutes, nowHM, taskMeta, today, weekStart, WORLD_LABEL } from '../lib/dates'
import type { Task, World } from '../lib/types'
import TaskRow from '../components/TaskRow'
import ExtractSheet from '../components/ExtractSheet'
import { Icon } from '../components/Icon'
import Menu from '../components/Menu'
import { enablePush, isIOS, isStandalone, pushPermission } from '../lib/push'
import { supabase } from '../lib/supabase'

function dismissed(key: string) { try { return localStorage.getItem('sg:' + today() + ':' + key) === '1' } catch { return false } }
function dismiss(key: string) { try { localStorage.setItem('sg:' + today() + ':' + key, '1') } catch { /* */ } }

export default function Home() {
  const profile = useStore((s) => s.profile)!
  const tasks = useStore((s) => s.tasks)
  const memberships = useStore((s) => s.memberships)
  const hhPeople = useStore((s) => s.householdPeople)
  const series = useStore((s) => s.series)
  const ready = useStore((s) => s.ready)
  const wf = useUI((u) => u.worldFilter)
  const nav = useNavigate()
  const [quick, setQuick] = useState('')
  const [extractOpen, setExtractOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [perm, setPerm] = useState(pushPermission())
  const [, force] = useState(0)
  const me = profile.id
  const t = today()
  const worlds = profile.worlds
  const filter = (x: Task) => wf === 'all' || x.world === wf || !worlds.includes(wf as World)

  const pendingIds = new Set(memberships.filter((m) => m.user_id === me && m.status === 'pending').map((m) => m.task_id))
  const declined = new Set(memberships.filter((m) => m.user_id === me && m.status === 'declined').map((m) => m.task_id))
  const visible = tasks.filter((x) => !pendingIds.has(x.id) && !declined.has(x.id) && filter(x))
  const pendingTasks = tasks.filter((x) => pendingIds.has(x.id))
  const hhInvite = hhPeople.find((p) => p.id === me && p.status === 'pending')

  const open = visible.filter((x) => x.status === 'open')
  const late = open.filter((x) => isOverdue(x, profile)).sort((a, b) => (deadlineOf(a, profile)?.getTime() ?? 0) - (deadlineOf(b, profile)?.getTime() ?? 0))
  const lateIds = new Set(late.map((x) => x.id))
  const todayTimed = open.filter((x) => !lateIds.has(x.id) && x.kind === 'timed' && x.due_date === t).sort((a, b) => (a.due_time! < b.due_time! ? -1 : 1))
  const todayDay = open.filter((x) => !lateIds.has(x.id) && x.kind === 'day' && x.due_date === t).sort((a, b) => b.priority - a.priority)
  const ws = weekStart(t), we = addDays(ws, 6)
  const week = open.filter((x) => !lateIds.has(x.id) && ((x.kind === 'week' && x.due_date! <= we) || (x.kind === 'deadline' && x.due_date! <= addDays(t, 7))))
  const doneUnique = visible.filter((x) => x.status === 'done' && x.done_at && ymd(new Date(x.done_at)) === t)
  const todayTotal = todayTimed.length + todayDay.length + doneUnique.filter((x) => x.due_date === t).length + late.filter((x) => x.due_date === t).length
  const doneCount = doneUnique.filter((x) => x.due_date === t).length
  const nowM = minutes(nowHM())
  const next = todayTimed.find((x) => minutes(x.due_time!.slice(0, 5)) >= nowM - 15) ?? todayDay.find((x) => x.priority >= 2)
  const openCount = late.length + todayTimed.length + todayDay.length

  const suggestions = useMemo(() => {
    const out: { key: string; text: string; actions: { label: string; fn: () => void; primary?: boolean }[] }[] = []
    if (late.length >= 3 && !dismissed('late')) out.push({ key: 'late', text: `יש לך ${late.length} משימות באיחור. להעביר את כולן למחר?`, actions: [{ label: 'העבר למחר', primary: true, fn: () => { late.forEach((x) => updateTask(x.id, { due_date: addDays(t, 1), postpone_count: x.postpone_count + 1, kind: x.kind === 'timed' ? 'timed' : 'day' })); toast('הועברו למחר') } }] })
    if (todayDay.length + todayTimed.length >= 9 && !dismissed('heavy')) {
      const low = [...todayDay].sort((a, b) => a.priority - b.priority)[0]
      if (low) out.push({ key: 'heavy', text: `היום עמוס (${todayDay.length + todayTimed.length} משימות). לדחות את "${low.title}" למחר?`, actions: [{ label: 'דחה', primary: true, fn: () => updateTask(low.id, { due_date: addDays(t, 1), postpone_count: low.postpone_count + 1 }) }] })
    }
    const stuck = open.find((x) => x.postpone_count >= 3)
    if (stuck && !dismissed('stuck:' + stuck.id)) out.push({ key: 'stuck:' + stuck.id, text: `דחית את "${stuck.title}" ${stuck.postpone_count} פעמים. לשנות אותה או לבטל?`, actions: [{ label: 'שנה', primary: true, fn: () => setUI({ openTaskId: stuck.id }) }, { label: 'בטל', fn: () => setTaskStatus(stuck.id, 'cancelled') }] })
    // repeated titles on same weekday without series
    const since = addDays(t, -42)
    const counts = new Map<string, { n: number; sample: Task }>()
    for (const x of tasks) {
      if (x.series_id || x.owner_id !== me || !x.due_date || x.due_date < since) continue
      if (new Date(x.due_date).getDay() !== new Date(t).getDay()) continue
      const k = x.title.trim()
      const c = counts.get(k) || { n: 0, sample: x }; c.n++; counts.set(k, c)
    }
    for (const [k, c] of counts) {
      if (c.n >= 3 && !series.some((s) => s.title === k) && !dismissed('rep:' + k)) {
        out.push({ key: 'rep:' + k, text: `בכל יום ${['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(t).getDay()]} אתה רושם "${k}". להפוך למשימה חוזרת?`, actions: [{ label: 'כן', primary: true, fn: async () => { const { addSeries } = await import('../lib/store'); addSeries({ world: c.sample.world, title: k, notes: null, priority: c.sample.priority, due_time: c.sample.due_time, reminder_min: c.sample.reminder_min, rule: { type: 'weekdays', days: [new Date(t).getDay()], start: addDays(t, 1) } }); toast('נוצרה משימה חוזרת') } }] })
        break
      }
    }
    return out.slice(0, 3)
  }, [tasks, late.length, todayDay.length, todayTimed.length, series, t, me]) // eslint-disable-line

  const quickAdd = async () => {
    const title = quick.trim(); if (!title) return
    const world: World = wf !== 'all' && worlds.includes(wf) ? wf : worlds[0]
    await addTasks([newTask({ title, world, kind: 'day', due_date: t })])
    setQuick('')
    toast('נוסף להיום')
  }

  const shopWorld = wf !== 'all' && profile.shopping_worlds.includes(wf) ? wf : null
  const initial = (profile.display_name || '?').trim()[0]

  if (!ready && !tasks.length) return <div className="page"><div className="skeleton" style={{ height: 40, width: 160 }} /><div className="skeleton" style={{ height: 70 }} /><div className="skeleton" style={{ height: 160 }} /><div className="skeleton" style={{ height: 220 }} /></div>

  return (
    <div className="page">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="small" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: 0.3 }}>יום {DAY_NAMES[new Date().getDay()]}</span>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>{hebDate(t, false)}</span>
          <span className="small muted">{hebrewDate()}</span>
        </div>
        <button className="avatar" aria-label="תפריט" onClick={() => setMenu(true)}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : initial}</button>
      </div>

      {worlds.length > 1 && (
        <div className="seg" role="tablist" aria-label="מעבר בין עולמות">
          <button className={wf === 'all' ? 'on' : ''} onClick={() => setUI({ worldFilter: 'all' })}>הכל</button>
          {worlds.map((w) => <button key={w} className={wf === w ? 'on' : ''} onClick={() => setUI({ worldFilter: w })}><span className={'dot ' + w} style={{ marginInlineEnd: 6 }} />{WORLD_LABEL[w]}</button>)}
        </div>
      )}

      <h1 className="hero"><span className="light">{greeting()}</span>{openCount === 0 ? 'אין כלום על הפרק.' : openCount === 1 ? 'דבר אחד על הפרק.' : `${openCount} דברים על הפרק.`}</h1>

      {perm !== 'granted' && perm !== 'unsupported' && (
        <div className="banner"><Icon name="bell" size={18} /><span className="grow">הפעל התראות כדי שלא תפספס כלום</span><button className="btn sm primary" onClick={async () => setPerm((await enablePush()) === 'granted' ? 'granted' : pushPermission())}>הפעל</button></div>
      )}
      {perm === 'unsupported' && isIOS() && !isStandalone() && (
        <div className="banner"><Icon name="bell" size={18} /><span className="grow">להתראות: שיתוף ← "הוסף למסך הבית", ופתח משם</span></div>
      )}

      <div className="shell"><div className="core" style={{ padding: 8, gap: 8 }}>
        <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); quickAdd() }}>
          <Icon name="plus" size={20} style={{ color: 'var(--accent)', marginInlineStart: 8, flexShrink: 0 }} />
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="כתוב משימה חדשה..." aria-label="כתוב משימה חדשה" style={{ border: 'none', background: 'transparent', padding: '0 4px', height: 44, fontSize: 16 }} />
          {quick ? <button type="submit" className="btn sm primary">הוסף</button> : null}
        </form>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm chip grow" onClick={() => setUI({ newTask: true })}><Icon name="list" size={16} />משימה מפורטת</button>
          {profile.ai_enabled && <button className="btn sm chip grow" onClick={() => setExtractOpen(true)}><Icon name="camera" size={16} />מתמונה או טקסט</button>}
        </div>
      </div></div>

      {(pendingTasks.length > 0 || hhInvite) && (
        <div className="shell"><div className="core" style={{ gap: 10 }}>
          <div className="section-label" style={{ color: 'var(--accent)' }}>ממתין לאישור שלך</div>
          {hhInvite && (
            <div className="row"><span className="grow">הוזמנת לבית משותף</span>
              <button className="btn sm primary" onClick={async () => { await supabase.rpc('respond_household', { p_accept: true }); refresh() }}>הצטרף</button>
              <button className="btn sm" onClick={async () => { await supabase.rpc('respond_household', { p_accept: false }); refresh() }}>לא</button></div>
          )}
          {pendingTasks.map((x) => {
            const m = memberships.find((mm) => mm.task_id === x.id && mm.user_id === me)
            const from = getState().users.find((u) => u.id === m?.invited_by)?.display_name || 'מישהו'
            return <button key={x.id} className="row" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'right', color: 'var(--text)' }} onClick={() => setUI({ openTaskId: x.id })}>
              <span className="grow"><div style={{ fontWeight: 500 }}>{x.title}</div><div className="small muted">{from} {m?.role === 'assignee' ? 'הטיל עליך' : 'שיתף איתך'} · {taskMeta(x)}</div></span><Icon name="chevron" size={16} /></button>
          })}
          {pendingTasks.length > 1 && <button className="btn sm primary" onClick={() => respondTasks(pendingTasks.map((x) => x.id), true)}>אשר הכל ({pendingTasks.length})</button>}
        </div></div>
      )}

      {next && (
        <div className="shell"><div className="core">
          <div className="between">
            <span className="small" style={{ color: 'var(--accent)', fontWeight: 500 }}>{next.kind === 'timed' ? (minutes(next.due_time!.slice(0, 5)) - nowM > 0 ? `הבא בתור · בעוד ${fmtIn(minutes(next.due_time!.slice(0, 5)) - nowM)}` : 'הבא בתור · עכשיו') : 'חשוב להיום'}</span>
            <span className="small muted row" style={{ gap: 6 }}><span className={'dot ' + next.world} />{WORLD_LABEL[next.world]}</span>
          </div>
          <button style={{ background: 'none', border: 'none', padding: 0, textAlign: 'right', color: 'var(--text)' }} onClick={() => setUI({ openTaskId: next.id })}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>{next.title}</div>
            <div className="small muted" style={{ marginTop: 4 }}>{taskMeta(next)}</div>
          </button>
          <div className="row">
            <button className="btn primary icon-end" onClick={() => setTaskStatus(next.id, 'done')}>ביצעתי<span className="in"><Icon name="check" size={18} stroke={1.75} /></span></button>
            <button className="btn" onClick={() => setUI({ openTaskId: next.id + '#postpone' })}>דחה</button>
          </div>
        </div></div>
      )}

      <div className="grid2">
        <div className="card col" style={{ gap: 10 }}>
          <div className="small muted">הושלמו היום</div>
          <div className="big-num" style={{ fontSize: 24 }}>{doneCount}<span className="dim" style={{ fontWeight: 400 }}> / {Math.max(todayTotal, doneCount)}</span></div>
          <div className="segbar">{Array.from({ length: Math.min(Math.max(todayTotal, 1), 12) }).map((_, i) => <span key={i} className={i < Math.round(doneCount / Math.max(todayTotal, 1) * Math.min(Math.max(todayTotal, 1), 12)) ? 'on' : ''} />)}</div>
        </div>
        {late.length ? (
          <button className="card danger col" style={{ gap: 4, textAlign: 'right', color: 'var(--text)', alignItems: 'flex-start' }} onClick={() => setUI({ openTaskId: late[0].id })}>
            <span className="small" style={{ color: 'var(--danger)' }}>באיחור · {late.length}</span>
            <span style={{ fontWeight: 500 }}>{late[0].title}</span>
            <span className="small" style={{ color: 'var(--danger-sub)' }}>{taskMeta(late[0])}</span>
          </button>
        ) : (
          <div className="card col" style={{ gap: 6 }}>
            <span className="small muted">השבוע</span>
            <span className="big-num" style={{ fontSize: 24 }}>{week.length}</span>
            <span className="small muted">משימות פתוחות</span>
          </div>
        )}
      </div>

      {shopWorld && <Link to={`/shopping/${shopWorld}`} className="btn chip" style={{ textDecoration: 'none', color: 'var(--text)' }}><Icon name="cart" size={18} />רשימת קניות</Link>}
      {wf === 'all' && profile.shopping_worlds.length > 0 && worlds.length === 1 && <Link to={`/shopping/${profile.shopping_worlds[0]}`} className="btn chip" style={{ textDecoration: 'none', color: 'var(--text)' }}><Icon name="cart" size={18} />רשימת קניות</Link>}

      <Section label={`באיחור · ${late.length}`} danger items={late} showWorld={wf === 'all'} />
      <Section label="היום · בשעות" items={todayTimed.filter((x) => x.id !== next?.id)} showWorld={wf === 'all'} />
      <Section label="היום · במהלך היום" items={todayDay.filter((x) => x.id !== next?.id)} showWorld={wf === 'all'} />
      <Section label="השבוע" items={week} showWorld={wf === 'all'} />

      {suggestions.map((s) => (
        <div key={s.key} className="card" style={{ background: 'transparent', borderStyle: 'dashed' }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Icon name="idea" size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <div className="col grow" style={{ gap: 10 }}>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{s.text}</div>
              <div className="row">{s.actions.map((a) => <button key={a.label} className={'btn sm' + (a.primary ? ' primary' : '')} onClick={() => { a.fn(); dismiss(s.key); force((n) => n + 1) }}>{a.label}</button>)}
                <button className="btn sm ghost" onClick={() => { dismiss(s.key); force((n) => n + 1) }}>לא עכשיו</button></div>
            </div>
          </div>
        </div>
      ))}

      <Section label={`בוצעו היום · ${doneUnique.length}`} items={doneUnique} showWorld={wf === 'all'} />

      {openCount === 0 && week.length === 0 && (
        <div className="empty">
          <div style={{ fontSize: 17, color: 'var(--text)', fontWeight: 500 }}>אין משימות להיום.</div>
          <div>ספר לי מה בתוכנית. לחץ על המיקרופון למטה.</div>
          <Icon name="chevron" size={22} style={{ transform: 'rotate(-90deg)', color: 'var(--accent)' }} />
        </div>
      )}

      {extractOpen && <ExtractSheet onClose={() => setExtractOpen(false)} />}
      {menu && <Menu onClose={() => setMenu(false)} nav={nav} />}
    </div>
  )
}

function hebrewDate() {
  try { return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) } catch { return '' }
}

function fmtIn(m: number) { if (m < 60) return `${m} דק׳`; if (m < 120) return m % 60 >= 10 ? `שעה ו-${m % 60} דק׳` : 'שעה'; return `${Math.round(m / 60)} שעות` }

function Section({ label, items, danger, showWorld }: { label: string; items: Task[]; danger?: boolean; showWorld?: boolean }) {
  if (!items.length) return null
  return (
    <div className="col" style={{ gap: 2 }}>
      <div className="section-label" style={danger ? { color: 'var(--danger)' } : undefined}>{label}</div>
      <div className="list">{items.map((x) => <TaskRow key={x.id} t={x} showWorld={showWorld} />)}</div>
    </div>
  )
}
