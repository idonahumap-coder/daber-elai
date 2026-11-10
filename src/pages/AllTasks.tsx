import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTaskStatus, stopSeries, useStore } from '../lib/store'
import { isOverdue, relDay, WORLD_LABEL } from '../lib/dates'
import type { World } from '../lib/types'
import TaskRow from '../components/TaskRow'
import { Icon } from '../components/Icon'

export default function AllTasks({ cancelled }: { cancelled?: boolean }) {
  const nav = useNavigate()
  const profile = useStore((s) => s.profile)!
  const tasks = useStore((s) => s.tasks)
  const series = useStore((s) => s.series)
  const [status, setStatus] = useState<'open' | 'late' | 'done' | 'series'>('open')
  const [world, setWorld] = useState<'all' | World>('all')
  const byWorld = (w: World) => world === 'all' || w === world

  if (cancelled) {
    const list = tasks.filter((t) => t.status === 'cancelled').sort((a, b) => (b.cancelled_at || '').localeCompare(a.cancelled_at || ''))
    return (
      <div className="page">
        <div className="row"><button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)}><Icon name="back" size={18} /></button><h2 className="title grow">משימות שבוטלו</h2></div>
        <div className="small muted">{list.length} משימות בוטלו ב-45 הימים האחרונים</div>
        <div className="list">{list.map((t) => (
          <div key={t.id} className="task">
            <div className="grow"><div className="t-title">{t.title}</div><div className="t-meta">{WORLD_LABEL[t.world]}{t.cancelled_at ? ` · בוטלה ${relDay(t.cancelled_at.slice(0, 10))}` : ''}</div></div>
            <button className="btn sm" onClick={() => setTaskStatus(t.id, 'open')}><Icon name="undo" size={16} />החזר</button>
          </div>
        ))}</div>
        {!list.length && <div className="empty">אין משימות שבוטלו</div>}
      </div>
    )
  }

  const open = tasks.filter((t) => t.status === 'open' && byWorld(t.world))
  const lists = {
    open: open.filter((t) => !isOverdue(t, profile)).sort((a, b) => (a.due_date || '9') + (a.due_time || '') < (b.due_date || '9') + (b.due_time || '') ? -1 : 1),
    late: open.filter((t) => isOverdue(t, profile)),
    done: tasks.filter((t) => t.status === 'done' && byWorld(t.world)).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''))
  }
  const activeSeries = series.filter((s) => s.active && byWorld(s.world))

  return (
    <div className="page">
      <div className="row"><button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)}><Icon name="back" size={18} /></button><h2 className="title grow">כל המשימות</h2></div>
      <div className="seg">
        <button className={status === 'open' ? 'on' : ''} onClick={() => setStatus('open')}>פתוחות</button>
        <button className={status === 'late' ? 'on' : ''} onClick={() => setStatus('late')}>באיחור</button>
        <button className={status === 'done' ? 'on' : ''} onClick={() => setStatus('done')}>בוצעו</button>
        <button className={status === 'series' ? 'on' : ''} onClick={() => setStatus('series')}>חוזרות</button>
      </div>
      {profile.worlds.length > 1 && (
        <div className="chips">
          <button className={'chip' + (world === 'all' ? ' on' : '')} onClick={() => setWorld('all')}>הכל</button>
          {profile.worlds.map((w) => <button key={w} className={'chip' + (world === w ? ' on' : '')} onClick={() => setWorld(w)}><span className={'dot ' + w} />{WORLD_LABEL[w]}</button>)}
        </div>
      )}
      {status === 'series' ? (
        <div className="list">{activeSeries.map((s) => (
          <div key={s.id} className="task">
            <Icon name="repeat" size={18} style={{ color: 'var(--accent)' }} />
            <div className="grow"><div className="t-title">{s.title}</div><div className="t-meta">{s.rule.type === 'daily' ? 'כל יום' : s.rule.type === 'weekdays' ? 'ימים: ' + (s.rule.days || []).map((d) => ['א','ב','ג','ד','ה','ו','ש'][d]).join(', ') : s.rule.type === 'monthly' ? `כל ${s.rule.day} בחודש` : `כל ${s.rule.every} ימים`}{s.due_time ? ` · ${s.due_time.slice(0, 5)}` : ''}</div></div>
            <button className="btn sm ghost" style={{ color: 'var(--danger)' }} onClick={() => { if (confirm('להפסיק את המשימה החוזרת?')) stopSeries(s.id) }}>הפסק</button>
          </div>
        ))}{!activeSeries.length && <div className="empty">אין משימות חוזרות</div>}</div>
      ) : (
        <>
          <div className="list">{lists[status].map((t) => <TaskRow key={t.id} t={t} showWorld={world === 'all'} />)}</div>
          {!lists[status].length && <div className="empty">אין כאן כלום</div>}
        </>
      )}
    </div>
  )
}
