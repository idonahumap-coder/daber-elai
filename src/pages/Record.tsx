import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { set } from 'idb-keyval'
import { extract } from '../lib/ai'
import { setUI } from '../lib/ui'
import { toast } from '../lib/store'
import { MAX_SEC, startRecording, type Rec } from '../lib/recorder'

const BARS = 23

export async function processAudio(blob: Blob, nav: (to: string, o?: { replace?: boolean }) => void) {
  if (!navigator.onLine) { await set('pendingAudio', blob); toast('אין חיבור. ההקלטה נשמרה ותיגזר כשהחיבור יחזור.'); nav('/'); return }
  try {
    const res = await extract({ audio: blob })
    setUI({ extraction: res })
    nav('/review', { replace: true })
  } catch (e) {
    await set('pendingAudio', blob)
    toast((e as Error).message)
    nav('/')
  }
}

export default function Record() {
  const nav = useNavigate()
  const [phase, setPhase] = useState<'starting' | 'rec' | 'busy'>('starting')
  const [sec, setSec] = useState(0)
  const [levels, setLevels] = useState<number[]>(Array(BARS).fill(4))
  const rec = useRef<Rec | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let timer = 0
    startRecording().then((r) => {
      if (!alive.current) { r.cancel(); return }
      rec.current = r
      setPhase('rec')
      r.onLevel((v) => setLevels((l) => [...l.slice(1), Math.max(4, Math.min(70, v * 0.9))]))
      timer = window.setInterval(() => {
        const s = Math.floor((Date.now() - r.startedAt) / 1000)
        setSec(s)
        if (s >= MAX_SEC) finish()
      }, 250)
    }).catch(() => { toast('אין גישה למיקרופון. אשר בהגדרות הטלפון.'); nav('/') })
    return () => { alive.current = false; clearInterval(timer); rec.current?.cancel() }
  }, []) // eslint-disable-line

  const finish = async () => {
    const r = rec.current; if (!r) return
    rec.current = null
    setPhase('busy')
    const blob = await r.stop()
    if (!blob) { toast('ההקלטה קצרה מדי'); nav('/'); return }
    await processAudio(blob, nav)
  }

  const left = MAX_SEC - sec
  const mm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 36px)' }}>
      <div className="between">
        <button className="btn" onClick={() => { rec.current?.cancel(); rec.current = null; nav('/') }} disabled={phase === 'busy'}>ביטול</button>
        {phase === 'rec' && <span className="pill-tag"><span className="dot rec-dot" style={{ background: 'var(--danger)' }} />מקליט</span>}
      </div>

      <div className="col" style={{ justifyContent: 'center', gap: 28, flex: 1 }}>
        {phase === 'busy' ? (
          <div className="col fade-in" style={{ alignItems: 'center', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <div style={{ fontSize: 18, fontWeight: 500 }}>גוזר את המשימות...</div>
          </div>
        ) : (
          <>
            <div className="col" style={{ alignItems: 'center', gap: 6 }}>
              <div className="small" style={{ color: 'var(--accent)' }}>{phase === 'rec' ? 'אני מקשיב' : 'מתחיל...'}</div>
              <div className="timer">{mm}</div>
              <div className="small" style={{ color: left <= 30 && phase === 'rec' ? 'var(--danger)' : 'var(--dim)' }}>{left <= 30 && phase === 'rec' ? `נשארו ${left} שניות` : 'מתוך 3:00'}</div>
            </div>
            <div className="wave" aria-hidden="true">{levels.map((h, i) => <span key={i} style={{ height: h, opacity: phase === 'rec' ? 0.35 + (i / BARS) * 0.65 : 0.25 }} />)}</div>
            <div className="shell"><div className="core" style={{ gap: 8 }}>
              <div className="small dim">טיפ</div>
              <div className="muted" style={{ lineHeight: 1.6 }}>דבר חופשי: "מחר בעשר להתקשר לרואה החשבון, לקנות חלב, ויש לי רעיון ל..." ואני אסדר למשימות, קניות ורעיונות.</div>
            </div></div>
          </>
        )}
      </div>

      {phase !== 'busy' && (
        <div className="col" style={{ alignItems: 'center', gap: 12 }}>
          <button className="stop" aria-label="סיים הקלטה" onClick={finish} disabled={phase !== 'rec'}><span /></button>
          <div className="small muted">לחיצה לסיום · אגזור את המשימות בשבילך</div>
        </div>
      )}
    </div>
  )
}
