import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { set } from 'idb-keyval'
import { extract } from '../lib/ai'
import { setUI } from '../lib/ui'
import { toast, useStore } from '../lib/store'

const MAX = 180
const BARS = 23

function pickMime() {
  const c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  for (const m of c) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  return ''
}

export default function Record() {
  const nav = useNavigate()
  const mode = useStore((s) => s.profile?.record_mode ?? 'toggle')
  const [phase, setPhase] = useState<'idle' | 'rec' | 'busy'>('idle')
  const [sec, setSec] = useState(0)
  const [levels, setLevels] = useState<number[]>(Array(BARS).fill(4))
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const raf = useRef(0)
  const timer = useRef(0)
  const cancelled = useRef(false)
  const startedAt = useRef(0)

  const cleanup = () => {
    cancelAnimationFrame(raf.current); clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null
  }

  const start = async () => {
    cancelled.current = false
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s
      const mime = pickMime()
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      r.onstop = onStop
      r.start(500)
      rec.current = r
      startedAt.current = Date.now()
      setPhase('rec'); setSec(0)
      timer.current = window.setInterval(() => {
        const s2 = Math.floor((Date.now() - startedAt.current) / 1000)
        setSec(s2)
        if (s2 >= MAX) stop()
      }, 250)
      try {
        const ctx = new AudioContext()
        const src = ctx.createMediaStreamSource(s)
        const an = ctx.createAnalyser(); an.fftSize = 64
        src.connect(an)
        const data = new Uint8Array(an.frequencyBinCount)
        const loop = () => {
          an.getByteFrequencyData(data)
          const avg = data.reduce((a, b) => a + b, 0) / data.length
          setLevels((l) => [...l.slice(1), Math.max(4, Math.min(70, avg * 0.9))])
          raf.current = requestAnimationFrame(loop)
        }
        loop()
      } catch { /* no analyser */ }
    } catch {
      toast('אין גישה למיקרופון. אשר בהגדרות הטלפון.')
      nav('/')
    }
  }

  const stop = () => { if (rec.current && rec.current.state !== 'inactive') rec.current.stop() }

  async function onStop() {
    cleanup()
    if (cancelled.current) return
    const blob = new Blob(chunks.current, { type: rec.current?.mimeType || 'audio/mp4' })
    if (blob.size < 2000) { toast('ההקלטה קצרה מדי'); nav('/'); return }
    if (!navigator.onLine) {
      await set('pendingAudio', blob)
      toast('אין חיבור. ההקלטה נשמרה ותיגזר כשהחיבור יחזור.')
      nav('/'); return
    }
    setPhase('busy')
    try {
      const res = await extract({ audio: blob })
      setUI({ extraction: res })
      nav('/review', { replace: true })
    } catch (e) {
      await set('pendingAudio', blob)
      toast((e as Error).message + ' ההקלטה נשמרה.')
      nav('/')
    }
  }

  useEffect(() => {
    if (mode === 'toggle') start()
    return () => { cancelled.current = true; try { rec.current?.stop() } catch { /* */ } cleanup() }
  }, []) // eslint-disable-line

  const left = MAX - sec
  const mm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 36px)' }}>
      <div className="between">
        <button className="btn" onClick={() => { cancelled.current = true; stop(); cleanup(); nav('/') }}>ביטול</button>
        {phase === 'rec' && <span className="pill-tag"><span className="dot" style={{ background: 'var(--danger)' }} />מקליט</span>}
      </div>

      <div className="col grow" style={{ justifyContent: 'center', gap: 28, flex: 1 }}>
        {phase === 'busy' ? (
          <div className="col" style={{ alignItems: 'center', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <div style={{ fontSize: 18, fontWeight: 500 }}>גוזר את המשימות...</div>
            <div className="muted small">זה לוקח כמה שניות</div>
          </div>
        ) : (
          <>
            <div className="col" style={{ alignItems: 'center', gap: 6 }}>
              <div className="small" style={{ color: 'var(--accent)' }}>{phase === 'rec' ? 'אני מקשיב' : mode === 'hold' ? 'החזק את הכפתור ודבר' : 'מתכונן...'}</div>
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
          {mode === 'hold' ? (
            <button className="stop" aria-label="החזק להקלטה" style={{ touchAction: 'none' }}
              onPointerDown={(e) => { e.preventDefault(); if (phase === 'idle') start() }}
              onPointerUp={() => stop()} onPointerLeave={() => phase === 'rec' && stop()} onContextMenu={(e) => e.preventDefault()}>
              <span style={{ borderRadius: phase === 'rec' ? 6 : 12 }} />
            </button>
          ) : (
            <button className="stop" aria-label="סיים הקלטה" onClick={stop} disabled={phase !== 'rec'}><span /></button>
          )}
          <div className="small muted">{mode === 'hold' ? 'שחרר לסיום' : 'לחיצה לסיום'} · אגזור את המשימות בשבילך</div>
        </div>
      )}
    </div>
  )
}
