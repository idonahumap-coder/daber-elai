import type { NavigateFunction } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Icon } from './Icon'

export default function Menu({ onClose, nav }: { onClose: () => void; nav: NavigateFunction }) {
  const p = useStore((s) => s.profile)!
  const go = (to: string) => { onClose(); nav(to) }
  const items: [string, string, string][] = [
    ['list', 'כל המשימות', '/tasks'],
    ['trash', 'משימות שבוטלו', '/cancelled'],
    ['users', 'בית משותף', '/household'],
    ['brain', 'מה האפליקציה יודעת עליי', '/learned'],
    ['settings', 'הגדרות', '/settings']
  ]
  if (p.is_admin) items.push(['shield', 'ניהול', '/admin'])
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="תפריט">
        <div className="grabber" />
        <div className="row">
          <div className="avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" /> : (p.display_name || '?')[0]}</div>
          <div className="grow"><div style={{ fontWeight: 600 }}>{p.display_name}</div><div className="small muted" dir="ltr" style={{ textAlign: 'right' }}>{p.email}</div></div>
        </div>
        <div className="col" style={{ gap: 0 }}>
          {items.map(([icon, label, to]) => (
            <button key={to} className="menu-item" onClick={() => go(to)}><Icon name={icon} size={20} /><span className="grow">{label}</span><Icon name="chevron" size={16} style={{ color: 'var(--dim)' }} /></button>
          ))}
          <button className="menu-item" style={{ borderBottom: 'none', color: 'var(--danger)' }} onClick={() => supabase.auth.signOut()}><Icon name="logout" size={20} /><span className="grow">יציאה</span></button>
        </div>
      </div>
    </>
  )
}
