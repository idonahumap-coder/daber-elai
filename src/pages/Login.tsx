import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/Icon'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const redirect = window.location.origin + window.location.pathname

  const google = async () => {
    setErr('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect, queryParams: { prompt: 'select_account' } } })
    if (error) setErr('הכניסה עם גוגל עוד לא מוגדרת. נסה עם מייל.')
  }
  const sendCode = async () => {
    if (!email.includes('@')) { setErr('כתובת מייל לא תקינה'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
    setBusy(false)
    if (error) setErr('לא הצלחתי לשלוח. נסה שוב בעוד דקה.'); else setSent(true)
  }
  const verify = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setErr('הקוד לא נכון או שפג תוקפו')
  }

  return (
    <div className="login">
      <div className="col" style={{ gap: 20 }}>
        <div className="logo"><Icon name="mic" size={32} stroke={1.75} /></div>
        <h1 className="hero"><span className="light">דבר אליי.</span>אתה מדבר, אני זוכר.</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>משימות, רעיונות וקניות. בקול, בכתב או בתמונה, ושום דבר לא נשכח.</p>
      </div>
      <div className="col" style={{ gap: 12 }}>
        <button className="btn lg primary block" onClick={google}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14zM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" /></svg>
          כניסה עם Google
        </button>
        <div className="row dim small" style={{ justifyContent: 'center' }}>או עם קוד למייל</div>
        {!sent ? (
          <div className="row">
            <input type="email" inputMode="email" dir="ltr" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="מייל" />
            <button className="btn" onClick={sendCode} disabled={busy}>{busy ? '...' : 'שלח'}</button>
          </div>
        ) : (
          <div className="col">
            <div className="small muted">שלחתי קוד ל-{email}. הקלד אותו כאן, או לחץ על הקישור במייל.</div>
            <div className="row">
              <input inputMode="numeric" dir="ltr" placeholder="קוד" value={code} onChange={(e) => setCode(e.target.value)} aria-label="קוד" />
              <button className="btn primary" onClick={verify} disabled={busy || code.length < 6}>כניסה</button>
            </div>
          </div>
        )}
        {err && <div className="small" style={{ color: 'var(--danger)' }}>{err}</div>}
        <div className="xs dim" style={{ textAlign: 'center', lineHeight: 1.6 }}>הכניסה בהזמנה בלבד ובאישור מנהל. מנהל המערכת יכול לצפות בנתוני שימוש מצטברים.</div>
      </div>
    </div>
  )
}
