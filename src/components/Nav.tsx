import { useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useStore, toast } from '../lib/store'
import { startRecording, type Rec } from '../lib/recorder'
import { processAudio } from '../pages/Record'

const BARS = 23

export default function Nav() {
  const nav = useNavigate()
  const ai = useStore((s) => s.profile?.ai_enabled)
  const rec = useRef<Rec | null>(null)
  const pressed = useRef(false)
  const [holding, setHolding] = useState<'off' | 'rec' | 'busy'>('off')
  const [sec, setSec] = useState(0)
  const [levels, setLevels] = useState<number[]>(Array(BARS).fill(4))
  const timer = useRef(0)

  const guard = () => { if (!ai) { toast('הקלטה עם AI עוד לא הופעלה לחשבון שלך'); return false } return true }

  const longT = useRef(0)
  const longFired = useRef(false)
  const holdStart = (e: React.PointerEvent) => {
    if (!ai) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    pressed.current = true; longFired.current = false
    clearTimeout(longT.current)
    longT.current = window.setTimeout(() => { if (pressed.current) { longFired.current = true; beginHold() } }, 280)
  }
  const beginHold = async () => {
    navigator.vibrate?.(15)
    setHolding('rec'); setSec(0); setLevels(Array(BARS).fill(4))
    try {
      const r = await startRecording()
      if (!pressed.current) { r.cancel(); setHolding('off'); return }
      rec.current = r
      r.onLevel((v) => setLevels((l) => [...l.slice(1), Math.max(4, Math.min(70, v * 0.9))]))
      timer.current = window.setInterval(() => setSec(Math.floor((Date.now() - r.startedAt) / 1000)), 250)
    } catch { setHolding('off'); toast('אין גישה למיקרופון. אשר בהגדרות הטלפון.') }
  }

  const holdEnd = async () => {
    clearTimeout(longT.current)
    pressed.current = false
    if (!longFired.current) return
    clearInterval(timer.current)
    const r = rec.current; rec.current = null
    if (!r) return
    setHolding('busy')
    const blob = await r.stop()
    if (!blob) { setHolding('off'); toast('ההקלטה קצרה מדי. החזק ודבר.'); return }
    await processAudio(blob, nav)
    setHolding('off')
  }

  const mm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

  return (
    <>
      {holding !== 'off' && (
        <div className="hold-overlay" aria-live="polite">
          {holding === 'busy' ? (
            <div className="col" style={{ alignItems: 'center', gap: 16 }}><div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} /><div style={{ fontSize: 18, fontWeight: 500 }}>גוזר את המשימות...</div></div>
          ) : (
            <div className="col" style={{ alignItems: 'center', gap: 20 }}>
              <span className="pill-tag"><span className="dot rec-dot" style={{ background: 'var(--danger)' }} />מקליט</span>
              <div className="timer">{mm}</div>
              <div className="wave" aria-hidden="true">{levels.map((h, i) => <span key={i} style={{ height: h, opacity: 0.35 + (i / BARS) * 0.65 }} />)}</div>
              <div className="muted">שחרר את הכפתור כשסיימת</div>
            </div>
          )}
        </div>
      )}
      <nav className="nav" aria-label="ניווט ראשי">
        <NavLink to="/" end aria-label="בית" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="home" /></NavLink>
        <NavLink to="/calendar" aria-label="לוח שנה" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="cal" /></NavLink>
        <button
          className={'rec' + (holding === 'rec' ? ' recording' : '')} aria-label="דבר אליי"
          onClick={() => { if (longFired.current) { longFired.current = false; return } if (guard()) nav('/record') }}
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerCancel={holdEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Icon name="mic" size={26} stroke={1.75} />
        </button>
        <NavLink to="/ideas" aria-label="רעיונות" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="idea" /></NavLink>
        <NavLink to="/insights" aria-label="תובנות" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="chart" /></NavLink>
      </nav>
    </>
  )
}
