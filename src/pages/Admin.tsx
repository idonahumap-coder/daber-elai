import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast, useStore } from '../lib/store'
import { Icon } from '../components/Icon'

interface U {
  id: string; email: string; display_name: string; avatar_url: string | null; status: string; is_admin: boolean; ai_enabled: boolean; ai_daily_limit: number
  delete_requested: boolean; created_at: string; last_active_at: string | null; ai_today: number; ai_month: number; tasks_total: number; tasks_done_30: number; tasks_30: number
}

export default function Admin() {
  const nav = useNavigate()
  const isAdmin = useStore((s) => s.profile?.is_admin)
  const [users, setUsers] = useState<U[]>([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = async () => {
    const [u, s] = await Promise.all([supabase.rpc('admin_users'), supabase.rpc('admin_stats')])
    setUsers(u.data || []); setStats(s.data || null)
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])
  if (!isAdmin) return <div className="page"><div className="empty">אין גישה</div></div>

  const set = async (id: string, patch: { status?: string; ai?: boolean; limit?: number }) => {
    await supabase.rpc('admin_set_user', { p_user: id, p_status: patch.status ?? null, p_ai: patch.ai ?? null, p_limit: patch.limit ?? null })
    load()
  }
  const del = async (u: U) => {
    if (!confirm(`למחוק לצמיתות את ${u.display_name}? כל המידע שלו יימחק.`)) return
    const { error } = await supabase.rpc('admin_delete_user', { p_user: u.id })
    if (error) toast('המחיקה נכשלה'); else { toast('נמחק'); load() }
  }
  const link = window.location.origin + window.location.pathname
  const pending = users.filter((u) => u.status === 'pending')
  const delReq = users.filter((u) => u.delete_requested)
  const mb = stats ? (stats.db_bytes / 1048576).toFixed(1) : '-'
  const rel = (iso: string | null) => { if (!iso) return 'אף פעם'; const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000); return h < 1 ? 'עכשיו' : h < 24 ? `לפני ${h} ש׳` : `לפני ${Math.round(h / 24)} ימים` }

  return (
    <div className="page">
      <div className="row"><button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)}><Icon name="back" size={18} /></button><h2 className="title grow">ניהול</h2></div>

      <div className="grid2">
        <div className="card col" style={{ gap: 6 }}><span className="small muted">קריאות AI החודש</span><span className="big-num">{stats?.ai_month ?? '-'}</span><span className="small dim">היום: {stats?.ai_today ?? '-'}</span></div>
        <div className="card col" style={{ gap: 6 }}><span className="small muted">עלות AI</span><span className="big-num">$0</span><span className="small dim">מסלול חינמי · {Math.round((stats?.tokens_month ?? 0) / 1000)}K טוקנים</span></div>
        <div className="card col" style={{ gap: 6 }}><span className="small muted">משתמשים</span><span className="big-num">{stats?.users ?? '-'}</span></div>
        <div className="card col" style={{ gap: 6 }}><span className="small muted">מסד נתונים</span><span className="big-num" style={{ fontSize: 24 }}>{mb} MB</span><span className="small dim">מתוך 500 MB חינם</span></div>
      </div>

      <div className="card col">
        <div className="small muted">קישור הזמנה. שלח אותו, והמוזמן יופיע כאן לאישור.</div>
        <div className="row"><input readOnly value={link} dir="ltr" /><button className="icon-btn" aria-label="העתק" onClick={() => { navigator.clipboard.writeText(link); toast('הועתק') }}><Icon name="copy" size={18} /></button></div>
      </div>

      {pending.length > 0 && (
        <div className="col">
          <div className="section-label" style={{ color: 'var(--accent)' }}>ממתינים לאישור · {pending.length}</div>
          {pending.map((u) => (
            <div key={u.id} className="card col">
              <div><div style={{ fontWeight: 500 }}>{u.display_name}</div><div className="small muted" dir="ltr" style={{ textAlign: 'right' }}>{u.email}</div></div>
              <div className="row">
                <button className="btn sm primary" onClick={() => set(u.id, { status: 'approved', ai: true })}>אשר עם AI</button>
                <button className="btn sm" onClick={() => set(u.id, { status: 'approved', ai: false })}>אשר בלי AI</button>
                <button className="btn sm ghost" style={{ color: 'var(--danger)' }} onClick={() => set(u.id, { status: 'rejected' })}>דחה</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {delReq.length > 0 && (
        <div className="col">
          <div className="section-label" style={{ color: 'var(--danger)' }}>בקשות מחיקה</div>
          {delReq.map((u) => <div key={u.id} className="card row"><span className="grow">{u.display_name}</span><button className="btn sm danger" onClick={() => del(u)}>מחק</button></div>)}
        </div>
      )}

      <div className="section-label">משתמשים</div>
      <div className="list">
        {users.filter((u) => u.status !== 'pending').map((u) => (
          <div key={u.id} className="col" style={{ borderBottom: '1px solid var(--line)', padding: '12px 4px', gap: 10 }}>
            <button className="row" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'right', color: 'var(--text)' }} onClick={() => setOpen(open === u.id ? null : u.id)}>
              <div className="avatar" style={{ width: 36, height: 36 }}>{u.avatar_url ? <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" /> : (u.display_name || '?')[0]}</div>
              <div className="grow"><div style={{ fontWeight: 500 }}>{u.display_name}{u.is_admin ? ' · מנהל' : ''}{u.status === 'rejected' ? ' · נדחה' : ''}</div>
                <div className="small muted">{u.ai_enabled ? `AI · ${u.ai_today} היום` : 'בלי AI'} · פעיל {rel(u.last_active_at)}</div></div>
              <span className="small muted">{u.tasks_30 ? Math.round((u.tasks_done_30 / u.tasks_30) * 100) : 0}%</span>
            </button>
            {open === u.id && (
              <div className="col" style={{ gap: 10 }}>
                <div className="grid3 small">
                  <div className="card" style={{ padding: 10 }}><div className="muted">משימות</div><b>{u.tasks_total}</b></div>
                  <div className="card" style={{ padding: 10 }}><div className="muted">ביצוע 30 י׳</div><b>{u.tasks_30 ? Math.round((u.tasks_done_30 / u.tasks_30) * 100) : 0}%</b></div>
                  <div className="card" style={{ padding: 10 }}><div className="muted">AI החודש</div><b>{u.ai_month}</b></div>
                </div>
                {!u.is_admin && (
                  <>
                    <div className="switch"><span className="grow">הרשאת AI</span><button className={'toggle' + (u.ai_enabled ? ' on' : '')} role="switch" aria-checked={u.ai_enabled} aria-label="הרשאת AI" onClick={() => set(u.id, { ai: !u.ai_enabled })} /></div>
                    <div className="row"><span className="grow small">מכסה יומית</span>{[3, 5, 10, 20].map((n) => <button key={n} className={'chip' + (u.ai_daily_limit === n ? ' on' : '')} onClick={() => set(u.id, { limit: n })}>{n}</button>)}</div>
                    <div className="row">
                      {u.status === 'rejected' ? <button className="btn sm" onClick={() => set(u.id, { status: 'approved' })}>אשר</button> : <button className="btn sm" onClick={() => set(u.id, { status: 'rejected' })}>חסום</button>}
                      <button className="btn sm danger" onClick={() => del(u)}>מחק משתמש</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
