import { useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useStore, toast } from '../lib/store'

export default function Nav() {
  const nav = useNavigate()
  const down = useRef(0)
  const ai = useStore((s) => s.profile?.ai_enabled)
  const onUp = () => {
    const held = Date.now() - down.current
    down.current = 0
    if (held < 150) { toast('לחיצה ארוכה יותר כדי להקליט'); return }
    if (!ai) { toast('הקלטה עם AI עוד לא הופעלה לחשבון שלך'); return }
    nav('/record')
  }
  return (
    <nav className="nav" aria-label="ניווט ראשי">
      <NavLink to="/" end aria-label="בית" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="home" /></NavLink>
      <NavLink to="/calendar" aria-label="לוח שנה" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="cal" /></NavLink>
      <button
        className="rec" aria-label="דבר אליי"
        onPointerDown={() => { down.current = Date.now() }}
        onPointerUp={onUp}
        onPointerCancel={() => { down.current = 0 }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Icon name="mic" size={26} stroke={1.75} />
      </button>
      <NavLink to="/ideas" aria-label="רעיונות" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="idea" /></NavLink>
      <NavLink to="/insights" aria-label="תובנות" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="chart" /></NavLink>
    </nav>
  )
}
