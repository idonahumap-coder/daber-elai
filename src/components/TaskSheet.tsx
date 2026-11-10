import { useEffect, useMemo, useState } from 'react'
import { useUI, setUI } from '../lib/ui'
import {
  addSeries, addTasks, deleteTask, getState, newTask, postponeTask, respondTasks, setTaskStatus, shareTask, stopSeries, toast, updateTask, useStore
} from '../lib/store'
import type { Kind, Series, Task, World } from '../lib/types'
import { addDays, DAY_SHORT, fromMinutes, hm, minutes, nowHM, PRIORITY_LABEL, today, weekFriday, WORLD_LABEL } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { sharedWith } from './TaskRow'

type RecType = 'none' | Series['rule']['type']

export default function TaskSheet() {
  const raw = useUI((u) => u.openTaskId)
  const isNew = useUI((u) => u.newTask)
  const id = raw?.split('#')[0] ?? null
  const focusPostpone = raw?.endsWith('#postpone')
  const task = useStore((s) => (id ? s.tasks.find((t) => t.id === id) : undefined))
  if (!isNew && !task) return null
  return <SheetInner key={id ?? 'new'} task={task} focusPostpone={!!focusPostpone} />
}

function close() { setUI({ openTaskId: null, newTask: false }) }

function SheetInner({ task, focusPostpone }: { task?: Task; focusPostpone: boolean }) {
  const profile = useStore((s) => s.profile)!
  const me = profile.id
  const users = useStore((s) => s.users)
  const hhPeople = useStore((s) => s.householdPeople)
  const household = useStore((s) => s.household)
  const memberships = useStore((s) => s.memberships)
  const worldFilter = useUI((u) => u.worldFilter)
  const defaultWorld: World = worldFilter !== 'all' ? worldFilter : profile.worlds[0] ?? 'personal'

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [world, setWorld] = useState<World>(task?.world ?? defaultWorld)
  const [kind, setKind] = useState<Kind>(task?.kind ?? 'day')
  const [date, setDate] = useState(task?.due_date ?? today())
  const [time, setTime] = useState(hm(task?.due_time) || fromMinutes(Math.min(minutes(nowHM()) + 60, 23 * 60)).slice(0, 3) + '00')
  const [priority, setPriority] = useState(task?.priority ?? 1)
  const [reminder, setReminder] = useState<number>(task?.reminder_min ?? profile.default_reminder_min)
  const [rec, setRec] = useState<RecType>('none')
  const [recDays, setRecDays] = useState<number[]>([new Date().getDay()])
  const [recDay, setRecDay] = useState(new Date().getDate())
  const [recEvery, setRecEvery] = useState(2)
  const [showPostpone, setShowPostpone] = useState(focusPostpone)
  const [freeDate, setFreeDate] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [notifyPartner, setNotifyPartner] = useState(true)
  const [assignee, setAssignee] = useState<string | null>(task?.assignee_id ?? null)
  const [comments, setComments] = useState<{ id: string; user_id: string; body: string; created_at: string }[]>([])
  const [comment, setComment] = useState('')
  const [askSeries, setAskSeries] = useState(false)

  const names = task ? sharedWith(task) : []
  const myPending = task && memberships.find((m) => m.task_id === task.id && m.user_id === me && m.status === 'pending')
  const isShared = names.length > 0
  const worlds = profile.worlds

  useEffect(() => {
    if (task && isShared) supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at').then(({ data }) => setComments(data || []))
  }, [task, isShared])

  const kindOptions: { k: Kind; label: string }[] = [
    { k: 'day', label: 'כל היום' }, { k: 'timed', label: 'בשעה' }, { k: 'week', label: 'השבוע' }, { k: 'deadline', label: 'עד תאריך' }
  ]

  const build = (): Partial<Task> => ({
    title: title.trim(), notes: notes.trim() || null, world, kind, priority,
    due_date: kind === 'week' ? weekFriday(date) : date,
    due_time: kind === 'timed' ? time : null,
    reminder_min: kind === 'timed' ? reminder : null,
    assignee_id: world === 'home' ? assignee : null
  })

  const save = async () => {
    if (!title.trim()) { toast('צריך כותרת למשימה'); return }
    if (task) {
      await updateTask(task.id, build())
      toast('נשמר')
    } else if (rec !== 'none') {
      const rule: Series['rule'] = { type: rec, start: date }
      if (rec === 'weekdays') rule.days = recDays
      if (rec === 'monthly') rule.day = recDay
      if (rec === 'interval') rule.every = recEvery
      await addSeries({ world, title: title.trim(), notes: notes.trim() || null, priority, due_time: kind === 'timed' ? time : null, reminder_min: kind === 'timed' ? reminder : null, rule })
      toast('משימה חוזרת נוצרה')
    } else {
      const t = newTask(build())
      await addTasks([t])
      if (assignee && assignee !== me && world === 'home') await shareTask(t.id, assignee, 'assignee')
      toast('נוסף')
    }
    close()
  }

  const evening = useMemo(() => {
    const end = minutes(profile.day_end.slice(0, 5))
    const m = Math.max(18 * 60, Math.min(19 * 60, end - 60))
    return fromMinutes(m)
  }, [profile.day_end])

  const doPostpone = async (to: 'h1' | 'h2' | 'evening' | 'tomorrow' | 'nextweek') => {
    if (!task) return
    const nowM = minutes(nowHM())
    const t = today()
    if (to === 'h1' || to === 'h2') {
      const m = nowM + (to === 'h1' ? 60 : 120)
      await postponeTask(task.id, { due_date: m >= 1440 ? addDays(t, 1) : t, due_time: fromMinutes(m % 1440), kind: 'timed' })
    } else if (to === 'evening') {
      await postponeTask(task.id, { due_date: t, due_time: evening, kind: 'timed' })
    } else if (to === 'tomorrow') {
      await postponeTask(task.id, { due_date: addDays(t, 1), kind: task.kind === 'week' ? 'day' : undefined })
    } else {
      await postponeTask(task.id, { due_date: addDays(t, 7), kind: task.kind === 'week' ? 'week' : undefined })
    }
    close()
  }

  const cancel = async (all?: boolean) => {
    if (!task) return
    if (all && task.series_id) await stopSeries(task.series_id)
    await setTaskStatus(task.id, 'cancelled')
    close()
  }

  const sendComment = async () => {
    if (!task || !comment.trim()) return
    const row = { task_id: task.id, user_id: me, body: comment.trim() }
    setComments((c) => [...c, { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() }])
    setComment('')
    await supabase.from('task_comments').insert(row)
  }

  const shareCandidates = users.filter((u) => !names.includes(u.display_name || ''))
  const canEdit = !myPending

  return (
    <>
      <div className="overlay" onClick={close} />
      <div className="sheet" role="dialog" aria-label={task ? 'משימה' : 'משימה חדשה'}>
        <div className="grabber" />

        {myPending && task && (
          <div className="banner">
            <div className="grow">{myPending.role === 'assignee' ? 'הוטלה עליך משימה' : 'שיתפו איתך משימה'}. לאשר?</div>
            <button className="btn sm primary" onClick={() => { respondTasks([task.id], true); close() }}>אשר</button>
            <button className="btn sm" onClick={() => { respondTasks([task.id], false); close() }}>דחה</button>
          </div>
        )}

        <div className="col" style={{ gap: 12 }}>
          <input aria-label="כותרת" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="מה צריך לעשות?" autoFocus={!task}
            style={{ fontSize: 20, fontWeight: 600, background: 'transparent', border: 'none', padding: '4px 0' }} disabled={!canEdit} />

          {worlds.length > 1 && (
            <div className="chips" role="group" aria-label="עולם">
              {worlds.map((w) => (
                <button key={w} className={'chip' + (world === w ? ' on' : '')} onClick={() => setWorld(w)}><span className={'dot ' + w} />{WORLD_LABEL[w]}</button>
              ))}
            </div>
          )}

          <div className="chips" role="group" aria-label="מתי">
            {kindOptions.map((o) => <button key={o.k} className={'chip' + (kind === o.k ? ' on' : '')} onClick={() => setKind(o.k)}>{o.label}</button>)}
          </div>
          <div className="row">
            <div className="field grow"><label htmlFor="d">{kind === 'week' ? 'השבוע של' : kind === 'deadline' ? 'עד תאריך' : 'תאריך'}</label>
              <input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            {kind === 'timed' && <div className="field" style={{ width: 120 }}><label htmlFor="tm">שעה</label><input id="tm" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>}
          </div>
          {kind === 'timed' && (
            <div className="field"><label>תזכורת לפני</label>
              <div className="chips">
                {[0, 5, 15, 30, 60].map((m) => <button key={m} className={'chip' + (reminder === m ? ' on' : '')} onClick={() => setReminder(m)}>{m === 0 ? 'בזמן' : m === 60 ? 'שעה' : `${m} דק׳`}</button>)}
              </div>
            </div>
          )}

          <div className="field"><label>עדיפות</label>
            <div className="chips">
              {[3, 2, 1, 0].map((p) => <button key={p} className={'chip' + (priority === p ? ' on' : '')} onClick={() => setPriority(p)}>{PRIORITY_LABEL[p]}</button>)}
            </div>
          </div>

          {!task && (
            <div className="field"><label>חוזרת</label>
              <div className="chips">
                {([['none', 'לא'], ['daily', 'כל יום'], ['weekdays', 'ימים בשבוע'], ['monthly', 'פעם בחודש'], ['interval', 'כל כמה ימים']] as [RecType, string][]).map(([k, l]) =>
                  <button key={k} className={'chip' + (rec === k ? ' on' : '')} onClick={() => setRec(k)}>{l}</button>)}
              </div>
              {rec === 'weekdays' && (
                <div className="chips">{DAY_SHORT.map((d, i) => <button key={i} className={'chip' + (recDays.includes(i) ? ' on' : '')} style={{ minWidth: 40, justifyContent: 'center' }}
                  onClick={() => setRecDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))}>{d}</button>)}</div>
              )}
              {rec === 'monthly' && <div className="row"><span className="muted small">בכל</span><input type="number" min={1} max={31} value={recDay} onChange={(e) => setRecDay(+e.target.value)} style={{ width: 80 }} /><span className="muted small">לחודש</span></div>}
              {rec === 'interval' && (
                <div className="chips">{[2, 3, 4, 5].map((n) => <button key={n} className={'chip' + (recEvery === n ? ' on' : '')} onClick={() => setRecEvery(n)}>כל {n} ימים</button>)}
                  <input type="number" min={2} max={60} value={recEvery} onChange={(e) => setRecEvery(+e.target.value)} style={{ width: 80 }} aria-label="התאמה אישית" /></div>
              )}
            </div>
          )}

          {world === 'home' && household && hhPeople.length > 1 && (
            <div className="field"><label>על מי</label>
              <div className="chips">
                <button className={'chip' + (!assignee ? ' on' : '')} onClick={() => setAssignee(null)}>כולנו</button>
                {hhPeople.filter((p) => p.status === 'accepted').map((p) => <button key={p.id} className={'chip' + (assignee === p.id ? ' on' : '')} onClick={() => setAssignee(p.id)}>{p.id === me ? 'אני' : p.display_name}</button>)}
              </div>
            </div>
          )}

          <div className="field"><label htmlFor="notes">הערות</label>
            <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          {task && (
            <div className="field">
              <label>{isShared ? `משותף עם ${names.join(', ')}` : 'שיתוף'}</label>
              {!showShare ? <button className="chip dashed" onClick={() => setShowShare(true)}><Icon name="share" size={16} />שתף עם...</button> : (
                shareCandidates.length ? (
                  <div className="col">
                    {shareCandidates.map((u) => (
                      <div key={u.id} className="row">
                        <span className="grow">{u.display_name}</span>
                        <button className="btn sm" onClick={() => shareTask(task.id, u.id, 'shared')}>משותף</button>
                        <button className="btn sm" onClick={() => shareTask(task.id, u.id, 'assignee')}>תעשה אתה</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="muted small">אין עוד משתמשים במערכת לשתף איתם.</div>
              )}
            </div>
          )}

          {task && isShared && (
            <div className="field"><label>הערות שיתוף</label>
              {comments.map((c) => <div key={c.id} className="small"><b>{c.user_id === me ? 'אני' : users.find((u) => u.id === c.user_id)?.display_name}:</b> {c.body}</div>)}
              <div className="row"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="כתוב הערה" /><button className="icon-btn" aria-label="שלח" onClick={sendComment}><Icon name="send" size={18} /></button></div>
            </div>
          )}
        </div>

        {task && task.status === 'open' && canEdit && (
          <div className="shell">
            <div className="core" style={{ padding: 14, gap: 10 }}>
              <button className="between" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--muted)', fontSize: 13 }} onClick={() => setShowPostpone((v) => !v)}>
                <span>לדחות ל...</span><Icon name="chevron" size={16} style={{ transform: showPostpone ? 'rotate(-90deg)' : 'none' }} />
              </button>
              {showPostpone && (
                <>
                  <div className="grid3">
                    {task.kind === 'timed' && <button className="btn chip" onClick={() => doPostpone('h1')}>בעוד שעה</button>}
                    {task.kind === 'timed' && <button className="btn chip" onClick={() => doPostpone('h2')}>בעוד שעתיים</button>}
                    {minutes(nowHM()) < minutes(evening) && <button className="btn chip" onClick={() => doPostpone('evening')}>הערב</button>}
                    <button className="btn chip" onClick={() => doPostpone('tomorrow')}>מחר</button>
                    <button className="btn chip" onClick={() => doPostpone('nextweek')}>שבוע הבא</button>
                    <button className="btn chip" onClick={() => setFreeDate(true)}>בחירה</button>
                  </div>
                  {freeDate && <div className="row"><span className="muted small grow">בחר תאריך ושעה למעלה ולחץ "שמור שינויים"</span></div>}
                </>
              )}
            </div>
          </div>
        )}

        {task && task.status === 'open' && canEdit && isShared && (
          <label className="row small muted"><input type="checkbox" checked={notifyPartner} onChange={(e) => setNotifyPartner(e.target.checked)} style={{ width: 18, height: 18 }} />עדכן את השותף כשאני מסמן ביצעתי</label>
        )}

        <div className="grid2">
          {task && task.status === 'open' && canEdit ? (
            <button className="btn lg primary icon-end" style={{ justifyContent: 'space-between' }} onClick={() => { setTaskStatus(task.id, 'done', { notify: isShared && notifyPartner }); close() }}>
              <span style={{ paddingInlineStart: 12 }}>ביצעתי</span><span className="in"><Icon name="check" size={18} stroke={1.75} /></span>
            </button>
          ) : task && task.status !== 'open' ? (
            <button className="btn lg primary" onClick={() => { setTaskStatus(task.id, 'open'); close() }}><Icon name="undo" size={18} />החזר למשימות</button>
          ) : null}
          {canEdit && <button className={'btn lg' + (task ? '' : ' primary')} style={!task ? { gridColumn: 'span 2' } : undefined} onClick={save}>{task ? 'שמור שינויים' : 'הוסף משימה'}</button>}
        </div>

        {task && task.status === 'open' && canEdit && (
          askSeries ? (
            <div className="grid2">
              <button className="btn danger" onClick={() => cancel(false)}>רק את זו</button>
              <button className="btn danger" onClick={() => cancel(true)}>את כל הסדרה</button>
            </div>
          ) : <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={() => (task.series_id ? setAskSeries(true) : cancel())}>בטל משימה</button>
        )}
        {task && task.status === 'cancelled' && task.owner_id === me && (
          <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={() => { if (confirm('למחוק לצמיתות?')) { deleteTask(task.id); close() } }}>מחק לצמיתות</button>
        )}
      </div>
    </>
  )
}

export function openNewTask() { setUI({ newTask: true, openTaskId: null }) }
export const _g = getState
