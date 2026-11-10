import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { addDays, DAY_SHORT, deadlineOf, parseYmd, today, weekStart, WORLD_LABEL } from '../lib/dates'
import type { World } from '../lib/types'
import { Icon } from '../components/Icon'

interface Ev { task_id: string; type: string; world: string | null; at: string; planned_at: string | null }

export default function Insights() {
  const profile = useStore((s) => s.profile)!
  const tasks = useStore((s) => s.tasks)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [events, setEvents] = useState<Ev[]>([])
  const [summaries, setSummaries] = useState<{ id: string; kind: string; period_start: string; text: string | null }[]>([])

  useEffect(() => {
    const since = new Date(Date.now() - 70 * 86400000).toISOString()
    supabase.from('task_events').select('task_id,type,world,at,planned_at').eq('user_id', profile.id).gte('at', since).limit(5000).then(({ data }) => setEvents(data || []))
    supabase.from('summaries').select('id,kind,period_start,text').order('period_start', { ascending: false }).limit(6).then(({ data }) => setSummaries(data || []))
  }, [profile.id])

  const t = today()
  const from = period === 'day' ? t : period === 'week' ? weekStart(t) : t.slice(0, 8) + '01'
  const mine = tasks.filter((x) => x.owner_id === profile.id || x.assignee_id === profile.id)

  const s = useMemo(() => {
    const due = mine.filter((x) => x.due_date && x.due_date >= from && x.due_date <= t && x.status !== 'cancelled')
    const done = due.filter((x) => x.status === 'done')
    const onTime = done.filter((x) => { const dl = deadlineOf(x, profile); return !dl || (x.done_at && new Date(x.done_at) <= dl) })
    const byWorld = profile.worlds.map((w) => { const d = due.filter((x) => x.world === w); return { w, total: d.length, done: d.filter((x) => x.status === 'done').length } })
    const evIn = events.filter((e) => e.at.slice(0, 10) >= from)
    const postponed = evIn.filter((e) => e.type === 'postponed').length
    const cancelled = evIn.filter((e) => e.type === 'cancelled').length
    const topPost = [...mine].filter((x) => x.postpone_count > 0).sort((a, b) => b.postpone_count - a.postpone_count).slice(0, 3)
    // weekday completion rate over last 8 weeks
    const since8 = addDays(t, -56)
    const wd = Array.from({ length: 7 }, (_, i) => {
      const d = mine.filter((x) => x.due_date && x.due_date >= since8 && x.due_date <= t && x.status !== 'cancelled' && parseYmd(x.due_date).getDay() === i)
      return { total: d.length, rate: d.length ? d.filter((x) => x.status === 'done').length / d.length : 0 }
    })
    // heat: done events by weekday x 3h buckets
    const buckets = [6, 9, 12, 15, 18, 21]
    const heat = Array.from({ length: buckets.length }, () => Array(7).fill(0))
    for (const e of events) if (e.type === 'done') { const d = new Date(e.at); const h = d.getHours(); const b = buckets.findIndex((x, i) => h >= x && h < (buckets[i + 1] ?? 24)); if (b >= 0) heat[b][d.getDay()]++ }
    const maxHeat = Math.max(1, ...heat.flat())
    // trend
    const days = period === 'day' ? 7 : period === 'week' ? 7 : 30
    const trend = Array.from({ length: days }, (_, i) => {
      const d = addDays(period === 'week' ? weekStart(t) : addDays(t, -(days - 1)), i)
      const dd = mine.filter((x) => x.due_date === d && x.status !== 'cancelled')
      return { d, total: dd.length, rate: dd.length ? dd.filter((x) => x.status === 'done').length / dd.length : 0, future: d > t }
    })
    return { due, done, onTime, byWorld, postponed, cancelled, topPost, wd, heat, maxHeat, buckets, trend }
  }, [mine, events, from, t, period, profile]) // eslint-disable-line

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
  const strong = s.wd.map((x, i) => ({ ...x, i })).filter((x) => x.total >= 3).sort((a, b) => b.rate - a.rate)

  return (
    <div className="page">
      <h2 className="title">תובנות</h2>
      <div className="seg">
        {(['day', 'week', 'month'] as const).map((p) => <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{p === 'day' ? 'היום' : p === 'week' ? 'השבוע' : 'החודש'}</button>)}
      </div>

      <div className="grid2">
        <div className="card col" style={{ gap: 6 }}><span className="small muted">אחוז ביצוע</span><span className="big-num">{pct(s.done.length, s.due.length)}%</span><span className="small dim">{s.done.length} מתוך {s.due.length}</span></div>
        <div className="card col" style={{ gap: 6 }}><span className="small muted">עמידה ביעד</span><span className="big-num">{pct(s.onTime.length, s.done.length)}%</span><span className="small dim">בוצעו בזמן</span></div>
        <div className="card col" style={{ gap: 6 }}><span className="small muted">דחיות</span><span className="big-num">{s.postponed}</span></div>
        <div className="card col" style={{ gap: 6 }}><span className="small muted">ביטולים</span><span className="big-num">{s.cancelled}</span></div>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <div className="small muted">{period === 'month' ? '30 הימים האחרונים' : 'השבוע'} · אחוז ביצוע יומי</div>
        <div className="bars">
          {s.trend.map((x) => <div key={x.d} className="b"><i className={x.total ? '' : 'off'} style={{ height: `${x.total ? Math.max(4, x.rate * 100) : 3}%`, opacity: x.future ? 0.3 : 1 }} title={`${x.d}: ${Math.round(x.rate * 100)}%`} />{period !== 'month' && <span>{DAY_SHORT[parseYmd(x.d).getDay()]}</span>}</div>)}
        </div>
      </div>

      {profile.worlds.length > 1 && (
        <div className="card col" style={{ gap: 12 }}>
          <div className="small muted">לפי עולם</div>
          {s.byWorld.map((w) => (
            <div key={w.w} className="col" style={{ gap: 6 }}>
              <div className="between small"><span className="row" style={{ gap: 6 }}><span className={'dot ' + w.w} />{WORLD_LABEL[w.w as World]}</span><span className="muted">{pct(w.done, w.total)}% · {w.done}/{w.total}</span></div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--seg-off)', overflow: 'hidden' }}><div style={{ width: `${pct(w.done, w.total)}%`, height: '100%', background: `var(--w-${w.w})` }} /></div>
            </div>
          ))}
        </div>
      )}

      <div className="card col" style={{ gap: 12 }}>
        <div className="small muted">ימים חזקים וחלשים · 8 שבועות אחרונים</div>
        <div className="bars" style={{ height: 90 }}>
          {s.wd.map((x, i) => <div key={i} className="b"><i className={x.total ? '' : 'off'} style={{ height: `${x.total ? Math.max(4, x.rate * 100) : 3}%` }} /><span>{DAY_SHORT[i]}</span></div>)}
        </div>
        {strong.length >= 2 && <div className="small">הכי חזק ביום {['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][strong[0].i]} ({Math.round(strong[0].rate * 100)}%), הכי חלש ביום {['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][strong[strong.length - 1].i]} ({Math.round(strong[strong.length - 1].rate * 100)}%).</div>}
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <div className="small muted">מתי אתה מסמן "ביצעתי"</div>
        <div className="heat">
          <span />{DAY_SHORT.map((d) => <span key={d} style={{ textAlign: 'center' }}>{d}</span>)}
          {s.heat.map((row, bi) => [<span key={'l' + bi}>{String(s.buckets[bi]).padStart(2, '0')}</span>, ...row.map((v, di) => <i key={bi + '-' + di} style={{ background: v ? 'var(--accent)' : 'var(--seg-off)', opacity: v ? 0.25 + 0.75 * (v / s.maxHeat) : 1 }} />)])}
        </div>
      </div>

      {s.topPost.length > 0 && (
        <div className="card col" style={{ gap: 8 }}>
          <div className="small muted">הכי נדחות</div>
          {s.topPost.map((x) => <div key={x.id} className="between"><span>{x.title}</span><span className="small muted">{x.postpone_count} דחיות</span></div>)}
        </div>
      )}

      {summaries.length > 0 && (
        <div className="col">
          <div className="section-label">סיכומים קודמים</div>
          {summaries.map((m) => <div key={m.id} className="card"><div className="small muted">{m.kind === 'weekly' ? 'סיכום שבועי' : m.kind === 'monthly' ? 'סיכום חודשי' : 'סיכום יומי'} · {m.period_start}</div><div style={{ whiteSpace: 'pre-line', lineHeight: 1.6, marginTop: 6 }}>{m.text}</div></div>)}
        </div>
      )}

      <Link to="/learned" className="menu-item" style={{ borderBottom: 'none' }}><Icon name="brain" size={20} /><span className="grow">מה האפליקציה יודעת עליי</span><Icon name="chevron" size={16} /></Link>
    </div>
  )
}
