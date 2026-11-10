import { useRef, useState } from 'react'
import type { Task } from '../lib/types'
import { isOverdue, taskMeta, WORLD_LABEL } from '../lib/dates'
import { getState, setTaskStatus, useStore } from '../lib/store'
import { setUI } from '../lib/ui'
import { Icon } from './Icon'

export function sharedWith(t: Task) {
  const s = getState()
  const me = s.session?.user.id
  const others = s.memberships.filter((m) => m.task_id === t.id && m.status !== 'declined').map((m) => m.user_id)
  if (t.owner_id !== me) others.push(t.owner_id)
  const names = [...new Set(others)].filter((id) => id !== me).map((id) => s.users.find((u) => u.id === id)?.display_name || s.householdPeople.find((u) => u.id === id)?.display_name).filter(Boolean)
  return names as string[]
}

export default function TaskRow({ t, showWorld }: { t: Task; showWorld?: boolean }) {
  const profile = useStore((s) => s.profile)
  const mode = profile?.action_mode ?? 'buttons'
  const late = isOverdue(t, profile)
  const done = t.status === 'done'
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const wasDrag = useRef(false)
  const names = sharedWith(t)
  const assignee = t.assignee_id && t.assignee_id !== profile?.id ? getState().householdPeople.find((p) => p.id === t.assignee_id)?.display_name : null

  const meta = [taskMeta(t), showWorld ? WORLD_LABEL[t.world] : '', names.length ? `עם ${names.join(', ')}` : '', assignee ? `על ${assignee}` : '', t.series_id ? 'חוזרת' : ''].filter(Boolean).join(' · ')

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTaskStatus(t.id, done ? 'open' : 'done', { notify: names.length > 0 })
  }

  const handlers = mode === 'swipe' && !done ? {
    onPointerDown: (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY, moved: false } },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return
      const ddx = e.clientX - start.current.x, ddy = e.clientY - start.current.y
      if (!start.current.moved && Math.abs(ddy) > Math.abs(ddx)) { start.current = null; setDx(0); return }
      if (Math.abs(ddx) > 8) start.current.moved = true
      setDx(Math.max(-140, Math.min(140, ddx)))
    },
    onPointerUp: () => {
      const s = start.current; start.current = null
      if (s?.moved) {
        wasDrag.current = true
        if (dx < -90) setTaskStatus(t.id, 'done', { notify: names.length > 0 })
        else if (dx > 90) setUI({ openTaskId: t.id + '#postpone' })
      }
      setDx(0)
    },
    onPointerCancel: () => { start.current = null; setDx(0) }
  } : {}

  return (
    <div className="swipe-wrap">
      {mode === 'swipe' && <div className="swipe-bg"><span className="l">ביצעתי</span><span className="r">דחה</span></div>}
      <div
        className={'task' + (done ? ' done' : '') + (late ? ' late' : '')}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}
        onClick={() => { if (wasDrag.current) { wasDrag.current = false; return } setUI({ openTaskId: t.id }) }}
        {...handlers}
      >
        <button className={'check' + (done ? ' on' : '') + (late ? ' late' : '')} aria-label={done ? 'החזר למשימות' : 'סמן כבוצע'} onClick={toggle}>
          {done && <Icon name="check" size={16} stroke={2.5} />}
        </button>
        <div className="grow">
          <div className="t-title">{t.title}</div>
          {meta && <div className="t-meta">{meta}</div>}
        </div>
        {t.priority >= 2 && !done && <Icon name="flag" size={16} style={{ color: t.priority === 3 ? 'var(--danger)' : 'var(--w-work)' }} />}
        <span className={'dot ' + t.world} />
      </div>
    </div>
  )
}
