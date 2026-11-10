import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI, setUI } from '../lib/ui'
import { addCategory, addIdea, addSeries, addShop, addTasks, getState, newTask, toast, useStore } from '../lib/store'
import type { Extracted, World } from '../lib/types'
import { addDays, hm, relDay, today, weekFriday, PRIORITY_LABEL } from '../lib/dates'
import { Icon } from '../components/Icon'

type Zone = World | 'idea' | 'shop-personal' | 'shop-home'
interface Item extends Extracted { _id: string; zone: Zone }

const ZONE_LABEL: Record<Zone, string> = { personal: 'אישי', work: 'עבודה', home: 'בית משותף', idea: 'רעיונות', 'shop-personal': 'קניות · אישי', 'shop-home': 'קניות · בית' }

function zoneOf(x: Extracted, worlds: World[], shopWorlds: World[]): Zone {
  if (x.type === 'idea') return 'idea'
  if (x.type === 'shopping') {
    if (shopWorlds.includes(x.world) ) return x.world === 'home' ? 'shop-home' : 'shop-personal'
    if (shopWorlds.includes('home')) return 'shop-home'
    if (shopWorlds.includes('personal')) return 'shop-personal'
    return worlds.includes(x.world) ? x.world : worlds[0]
  }
  return worlds.includes(x.world) ? x.world : worlds[0]
}

function whenLabel(x: Item) {
  if (x.recurrence) {
    const r = x.recurrence
    const base = r.type === 'daily' ? 'כל יום' : r.type === 'weekdays' ? `כל ${(r.days || []).map((d) => ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'][d]).join(', ')}` : r.type === 'monthly' ? `כל ${r.day} בחודש` : `כל ${r.every} ימים`
    return base + (x.time ? ` · ${hm(x.time)}` : '')
  }
  if (!x.date) return null
  if (x.kind === 'week') return 'השבוע'
  if (x.kind === 'deadline') return `דדליין · ${relDay(x.date)}`
  const m = x.time ? minsUntil(x.date, x.time) : -1
  const soon = m > 0 && m < 180 ? ` · בעוד ${m < 60 ? m + ' דק׳' : Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ' שע׳'}` : ''
  return relDay(x.date) + (x.time ? ` · ${hm(x.time)}` : '') + soon
}

function minsUntil(date: string, time?: string | null) {
  if (!time) return 9999
  const [h, mi] = time.split(':').map(Number)
  const d = new Date(date + 'T00:00:00'); d.setHours(h, mi, 0, 0)
  return Math.round((d.getTime() - Date.now()) / 60000)
}

export default function Review() {
  const nav = useNavigate()
  const ext = useUI((u) => u.extraction)
  const profile = useStore((s) => s.profile)!
  const cats = useStore((s) => s.categories)
  const worlds = profile.worlds
  const shopWorlds = profile.shopping_worlds.filter((w) => worlds.includes(w))
  const [items, setItems] = useState<Item[]>(() => (ext?.items || []).map((x, i) => ({ ...x, _id: String(i), zone: zoneOf(x, worlds, shopWorlds), date: x.date ?? (x.type === 'task' && !x.question && !x.recurrence ? today() : x.date) })))
  const [showTr, setShowTr] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; over: Zone | null; y: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const zoneRefs = useRef<Partial<Record<Zone, HTMLDivElement | null>>>({})

  if (!ext) { nav('/', { replace: true }); return null }

  const zones: Zone[] = [...worlds.filter((w) => w !== 'home'), ...(worlds.includes('home') ? ['home' as Zone] : []), 'idea', ...shopWorlds.map((w) => (w === 'home' ? 'shop-home' : 'shop-personal') as Zone)]
  const upd = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x._id === id ? { ...x, ...p } : x)))
  const remove = (id: string) => setItems((xs) => xs.filter((x) => x._id !== id))

  const onHandleDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id, over: null, y: e.clientY })
  }
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag) return
    let over: Zone | null = null
    for (const z of zones) { const r = zoneRefs.current[z]?.getBoundingClientRect(); if (r && e.clientY >= r.top && e.clientY <= r.bottom) over = z }
    setDrag({ ...drag, over, y: e.clientY })
  }
  const onHandleUp = () => {
    if (drag?.over) {
      const z = drag.over
      upd(drag.id, { zone: z, type: z === 'idea' ? 'idea' : z.startsWith('shop') ? 'shopping' : 'task', world: (z === 'shop-home' ? 'home' : z === 'shop-personal' ? 'personal' : z === 'idea' ? 'personal' : z) as World })
    }
    setDrag(null)
  }

  const approve = async () => {
    setBusy(true)
    try {
      const tasks = []
      for (const x of items) {
        if (x.zone === 'idea') {
          let category_id: string | null = null
          if (x.category) category_id = (await addCategory(x.category)).id
          await addIdea({ title: x.title, category_id })
        } else if (x.zone === 'shop-home' || x.zone === 'shop-personal') {
          await addShop(x.title, x.qty || null, x.zone === 'shop-home')
        } else if (x.recurrence) {
          await addSeries({ world: x.zone, title: x.title, notes: null, priority: x.priority ?? 1, due_time: x.time || null, reminder_min: x.time ? profile.default_reminder_min : null, rule: { ...x.recurrence, start: x.recurrence.start || today() } })
        } else {
          const kind = x.kind || (x.time ? 'timed' : 'day')
          const date = x.date || today()
          tasks.push(newTask({ title: x.title, world: x.zone, kind, due_date: kind === 'week' ? weekFriday(date) : date, due_time: kind === 'timed' ? x.time || null : null, priority: x.priority ?? 1, reminder_min: kind === 'timed' ? (minsUntil(date, x.time) < profile.default_reminder_min + 2 ? 0 : profile.default_reminder_min) : null, source: 'ai' }))
        }
      }
      if (tasks.length) await addTasks(tasks)
      toast(`נשמרו ${items.length} פריטים`)
      setUI({ extraction: null })
      nav('/', { replace: true })
    } finally { setBusy(false) }
  }

  const dragging = drag ? items.find((x) => x._id === drag.id) : null

  return (
    <div className="page" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 110px)' }} onPointerMove={onHandleMove} onPointerUp={onHandleUp}>
      <div className="between">
        <button className="icon-btn" aria-label="סגור" onClick={() => { setUI({ extraction: null }); nav('/') }}><Icon name="x" size={18} /></button>
        {ext.transcript && <button className="btn ghost sm" onClick={() => setShowTr((v) => !v)}>{showTr ? 'הסתר תמלול' : 'הצג תמלול'}</button>}
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h2 className="title" style={{ fontSize: 28 }}>{items.length === 0 ? 'לא מצאתי משימות.' : items.length === 1 ? 'מצאתי דבר אחד.' : `מצאתי ${items.length} דברים.`}</h2>
        <div className="muted small">{items.length ? 'גרור פריט בין האזורים, או לחץ עליו לעריכה.' : 'נסה להקליט שוב, קצת יותר לאט.'}</div>
      </div>
      {showTr && <div className="card small muted" style={{ lineHeight: 1.7 }}>{ext.transcript}</div>}

      {zones.map((z) => {
        const list = items.filter((x) => x.zone === z)
        if (!list.length && !drag) return null
        const isShop = z.startsWith('shop')
        return (
          <div key={z} className="col">
            <div className="section-label">{z === 'idea' ? <Icon name="idea" size={14} /> : isShop ? <Icon name="cart" size={14} /> : <span className={'dot ' + z} />}{ZONE_LABEL[z]} · {list.length}</div>
            <div ref={(el) => { zoneRefs.current[z] = el }} className={'drop-zone' + (drag?.over === z ? ' over' : '')} style={{ minHeight: drag && !list.length ? 56 : undefined }}>
              {list.map((x) => (
                <div key={x._id} className={'x-item' + (drag?.id === x._id ? ' dragging' : '')}>
                  <span className="handle" onPointerDown={(e) => onHandleDown(e, x._id)} aria-label="גרור">
                    <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" /><circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" /></svg>
                  </span>
                  <div className="grow col" style={{ gap: 6 }}>
                    {editing === x._id ? (
                      <input value={x.title} autoFocus onChange={(e) => upd(x._id, { title: e.target.value })} onBlur={() => setEditing(null)} onKeyDown={(e) => e.key === 'Enter' && setEditing(null)} />
                    ) : <button style={{ background: 'none', border: 'none', padding: 0, textAlign: 'right', color: 'var(--text)', fontSize: 15, fontWeight: 500 }} onClick={() => setEditing(x._id)}>{x.title}</button>}
                    {isShop && x.qty && <span className="small muted">כמות: {x.qty}</span>}
                    {!isShop && z !== 'idea' && (
                      <div className="chips" style={{ gap: 6 }}>
                        {whenLabel(x) && <span className="pill-tag" style={{ color: 'var(--text)' }}>{whenLabel(x)}</span>}
                        {(x.priority ?? 1) >= 2 && <span className="pill-tag">{PRIORITY_LABEL[x.priority!]}</span>}
                      </div>
                    )}
                    {!isShop && z !== 'idea' && !x.date && !x.recurrence && (
                      <div className="col" style={{ gap: 6 }}>
                        <div className="small" style={{ color: 'var(--accent)' }}>{x.question || 'למתי?'}</div>
                        <div className="chips">
                          <button className="chip" onClick={() => upd(x._id, { date: today(), kind: x.time ? 'timed' : 'day' })}>היום</button>
                          <button className="chip" onClick={() => upd(x._id, { date: addDays(today(), 1), kind: x.time ? 'timed' : 'day' })}>מחר</button>
                          <button className="chip" onClick={() => upd(x._id, { date: today(), kind: 'week' })}>השבוע</button>
                          <input type="date" aria-label="בחר תאריך" style={{ width: 150, height: 34, padding: '0 10px' }} onChange={(e) => e.target.value && upd(x._id, { date: e.target.value, kind: x.time ? 'timed' : 'day' })} />
                        </div>
                      </div>
                    )}
                    {z === 'idea' && (
                      <div className="col" style={{ gap: 6 }}>
                        <div className="small" style={{ color: 'var(--accent)' }}>לשייך לקטגוריה?</div>
                        <div className="chips">
                          {[...new Set([...(x.category && !cats.some((c) => c.name === x.category) ? [x.category] : []), ...cats.map((c) => c.name)])].slice(0, 5).map((c) => (
                            <button key={c} className={'chip' + (x.category === c ? ' on' : '')} onClick={() => upd(x._id, { category: x.category === c ? null : c })}>{c}</button>
                          ))}
                          <button className={'chip' + (!x.category ? ' on' : '')} onClick={() => upd(x._id, { category: null })}>בלי</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button className="icon-btn" style={{ border: 'none', width: 36, height: 36 }} aria-label="הסר" onClick={() => remove(x._id)}><Icon name="x" size={16} /></button>
                </div>
              ))}
              {drag && !list.length && <div className="small dim" style={{ padding: 16, textAlign: 'center' }}>שחרר כאן</div>}
            </div>
          </div>
        )
      })}

      {dragging && drag && (
        <div style={{ position: 'fixed', top: drag.y - 22, left: 24, right: 24, height: 44, borderRadius: 22, background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 600, zIndex: 50, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>{dragging.title}</div>
      )}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 18px calc(env(safe-area-inset-bottom) + 18px)', background: 'var(--bg)', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, maxWidth: 520, margin: '0 auto', zIndex: 10 }}>
        {getState().profile?.ai_enabled && <button className="btn lg" onClick={() => nav('/record', { replace: true })}>הקלט שוב</button>}
        <button className="btn lg primary grow" style={{ justifyContent: 'space-between', paddingInlineEnd: 8 }} disabled={!items.length || busy} onClick={approve}>
          <span style={{ paddingInlineStart: 8 }}>{busy ? 'שומר...' : `אשר ${items.length} פריטים`}</span><span className="in"><Icon name="check" size={18} stroke={1.75} /></span>
        </button>
      </div>
    </div>
  )
}
