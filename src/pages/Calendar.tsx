import { useState } from 'react'
import { useStore } from '../lib/store'
import { setUI, useUI } from '../lib/ui'
import { addDays, DAY_NAMES, DAY_SHORT, hebDate, hm, minutes, parseYmd, today, weekStart, WORLD_LABEL } from '../lib/dates'
import type { Task } from '../lib/types'
import { Icon } from '../components/Icon'
import TaskRow from '../components/TaskRow'

export default function CalendarPage() {
  const profile = useStore((s) => s.profile)!
  const tasks = useStore((s) => s.tasks)
  const memberships = useStore((s) => s.memberships)
  const wf = useUI((u) => u.worldFilter)
  const [day, setDay] = useState(today())
  const [view, setView] = useState<'day' | 'week'>('day')
  const me = profile.id
  const hidden = new Set(memberships.filter((m) => m.user_id === me && m.status !== 'accepted').map((m) => m.task_id))
  const vis = tasks.filter((t) => t.status !== 'cancelled' && !hidden.has(t.id) && (wf === 'all' || t.world === wf))
  const onDay = (d: string) => vis.filter((t) => t.due_date === d && (t.kind === 'timed' || t.kind === 'day' || t.kind === 'deadline'))
  const ws = weekStart(day)
  const strip = Array.from({ length: 21 }, (_, i) => addDays(weekStart(today()), i - 7))

  const dayTasks = onDay(day)
  const timed = dayTasks.filter((t) => t.kind === 'timed' && t.due_time)
  const allDay = dayTasks.filter((t) => !(t.kind === 'timed' && t.due_time))
  const weekTasks = vis.filter((t) => t.kind === 'week' && t.due_date && weekStart(t.due_date) === ws)
  const startH = Math.min(Math.floor(minutes(profile.day_start.slice(0, 5)) / 60), ...timed.map((t) => Math.floor(minutes(hm(t.due_time)) / 60)))
  const endH = Math.max(Math.ceil(minutes(profile.day_end.slice(0, 5)) / 60), ...timed.map((t) => Math.floor(minutes(hm(t.due_time)) / 60) + 1))
  const hours = Array.from({ length: Math.max(1, endH - startH) }, (_, i) => startH + i)

  return (
    <div className="page">
      <div className="between">
        <h2 className="title">לוח שנה</h2>
        <div className="seg" style={{ width: 150 }}>
          <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>יום</button>
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>שבוע</button>
        </div>
      </div>

      <div className="cal-days" ref={(el) => { if (el && !el.dataset.s) { el.dataset.s = '1'; const on = el.querySelector('.on') as HTMLElement; on?.scrollIntoView({ inline: 'center', block: 'nearest' }) } }}>
        {strip.map((d) => {
          const has = onDay(d).some((t) => t.status === 'open')
          return (
            <button key={d} className={'cal-day' + (d === day ? ' on' : '')} onClick={() => setDay(d)} aria-label={hebDate(d)}>
              <span className="dd">{DAY_SHORT[parseYmd(d).getDay()]}</span><span className="n">{parseYmd(d).getDate()}</span>
              <span className="mk" style={{ opacity: has ? 1 : 0, background: d === day ? 'var(--bg)' : undefined }} />
            </button>
          )
        })}
      </div>

      {view === 'day' ? (
        <>
          <div className="between"><div style={{ fontWeight: 600 }}>{hebDate(day)}</div>
            <button className="btn sm" onClick={() => setUI({ newTask: true })}><Icon name="plus" size={16} />משימה</button></div>
          {allDay.length > 0 && <div className="col" style={{ gap: 2 }}><div className="section-label">במהלך היום</div><div className="list">{allDay.map((t) => <TaskRow key={t.id} t={t} showWorld={wf === 'all'} />)}</div></div>}
          {weekTasks.length > 0 && <div className="col" style={{ gap: 2 }}><div className="section-label">השבוע</div><div className="list">{weekTasks.map((t) => <TaskRow key={t.id} t={t} />)}</div></div>}
          <div className="col" style={{ gap: 0 }}>
            {hours.map((h) => {
              const items = timed.filter((t) => Math.floor(minutes(hm(t.due_time)) / 60) === h).sort((a, b) => (a.due_time! < b.due_time! ? -1 : 1))
              return (
                <div key={h} className="hour">
                  <div className="h">{String(h).padStart(2, '0')}:00</div>
                  <div className="items">{items.map((t) => <Ev key={t.id} t={t} />)}</div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="col" style={{ gap: 14 }}>
          {weekTasks.length > 0 && <div className="col" style={{ gap: 2 }}><div className="section-label">משימות לשבוע</div><div className="list">{weekTasks.map((t) => <TaskRow key={t.id} t={t} />)}</div></div>}
          {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => {
            const list = onDay(d).sort((a, b) => (a.due_time || '99') < (b.due_time || '99') ? -1 : 1)
            return (
              <div key={d} className="col" style={{ gap: 6 }}>
                <button className="section-label" style={{ background: 'none', border: 'none', padding: 0, color: d === today() ? 'var(--accent)' : 'var(--muted)' }} onClick={() => { setDay(d); setView('day') }}>
                  יום {DAY_NAMES[parseYmd(d).getDay()]} · {parseYmd(d).getDate()}/{parseYmd(d).getMonth() + 1}
                </button>
                {list.length ? list.map((t) => <Ev key={t.id} t={t} />) : <div className="small dim">אין משימות</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Ev({ t }: { t: Task }) {
  return (
    <button className={'ev' + (t.status === 'done' ? ' done' : '')} onClick={() => setUI({ openTaskId: t.id })}>
      <span className={'dot ' + t.world} />
      <span className="grow">{t.title}</span>
      <span className="small muted">{t.due_time ? hm(t.due_time) : WORLD_LABEL[t.world]}</span>
    </button>
  )
}
