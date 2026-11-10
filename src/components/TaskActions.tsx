import { useState } from 'react'
import { useUI, setUI } from '../lib/ui'
import { postponeTask, setTaskStatus, stopSeries, useStore } from '../lib/store'
import { addDays, fromMinutes, minutes, nowHM, taskMeta, today } from '../lib/dates'
import { Icon } from './Icon'

/** Small centered popup when tapping a task: done / postpone / cancel / edit */
export default function TaskActions() {
  const raw = useUI((u) => u.openTaskId)
  const id = raw && !raw.endsWith('#edit') ? raw.split('#')[0] : null
  const task = useStore((s) => (id ? s.tasks.find((t) => t.id === id) : undefined))
  const dayEnd = useStore((s) => s.profile?.day_end ?? '22:00')
  const [post, setPost] = useState(false)
  const [askSeries, setAskSeries] = useState(false)
  const [leaving, setLeaving] = useState(false)
  if (!task) return null

  const close = () => { setLeaving(true); setTimeout(() => { setUI({ openTaskId: null }); setLeaving(false); setPost(false); setAskSeries(false) }, 180) }
  const evening = fromMinutes(Math.max(18 * 60, Math.min(19 * 60, minutes(dayEnd.slice(0, 5)) - 60)))
  const nowM = minutes(nowHM())
  const t = today()
  const doPost = async (to: 'h1' | 'evening' | 'tomorrow' | 'nextweek') => {
    if (to === 'h1') { const m = nowM + 60; await postponeTask(task.id, { due_date: m >= 1440 ? addDays(t, 1) : t, due_time: fromMinutes(m % 1440), kind: 'timed' }) }
    else if (to === 'evening') await postponeTask(task.id, { due_date: t, due_time: evening, kind: 'timed' })
    else if (to === 'tomorrow') await postponeTask(task.id, { due_date: addDays(t, 1), kind: task.kind === 'week' ? 'day' : undefined })
    else await postponeTask(task.id, { due_date: addDays(t, 7), kind: task.kind === 'week' ? 'week' : undefined })
    close()
  }
  const cancel = async (all?: boolean) => {
    if (all && task.series_id) await stopSeries(task.series_id)
    await setTaskStatus(task.id, 'cancelled'); close()
  }
  const open = task.status === 'open'

  return (
    <>
      <div className={'overlay pop-ov' + (leaving ? ' out' : '')} onClick={close} />
      <div className={'pop' + (leaving ? ' out' : '')} role="dialog" aria-label="פעולות למשימה">
        <div className="col" style={{ gap: 2 }}>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>{task.title}</div>
          <div className="small muted">{taskMeta(task)}</div>
        </div>

        {open ? (
          askSeries ? (
            <div className="grid2">
              <button className="btn danger" onClick={() => cancel(false)}>רק את זו</button>
              <button className="btn danger" onClick={() => cancel(true)}>את כל הסדרה</button>
            </div>
          ) : (
            <div className="grid3">
              <button className="btn primary" onClick={() => { setTaskStatus(task.id, 'done', { notify: !!task.household_id }); close() }}><Icon name="check" size={18} stroke={2} />ביצעתי</button>
              <button className={'btn' + (post ? ' on' : '')} onClick={() => setPost((v) => !v)}>דחה</button>
              <button className="btn" style={{ color: 'var(--danger)' }} onClick={() => (task.series_id ? setAskSeries(true) : cancel())}>בטל</button>
            </div>
          )
        ) : (
          <button className="btn primary" onClick={() => { setTaskStatus(task.id, 'open'); close() }}><Icon name="undo" size={18} />לא ביצעתי · החזר</button>
        )}

        {post && open && (
          <div className="grid2">
            <button className="btn sm" onClick={() => doPost('h1')}>בעוד שעה</button>
            {nowM < minutes(evening) ? <button className="btn sm" onClick={() => doPost('evening')}>הערב</button> : <span />}
            <button className="btn sm" onClick={() => doPost('tomorrow')}>מחר</button>
            <button className="btn sm" onClick={() => doPost('nextweek')}>שבוע הבא</button>
          </div>
        )}

        <button className="btn ghost" onClick={() => setUI({ openTaskId: task.id + '#edit' })}><Icon name="note" size={18} />עריכה</button>
      </div>
    </>
  )
}
