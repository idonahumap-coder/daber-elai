import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const redirect = window.location.origin + window.location.pathname

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setInfo('')
    if (!email.includes('@')) { setErr('כתובת מייל לא תקינה'); return }
    if (password.length < 8) { setErr('הסיסמה צריכה להיות לפחות 8 תווים'); return }
    setBusy(true)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setErr(error.message.includes('confirm') ? 'צריך קודם לאשר את המייל (בדוק את תיבת הדואר)' : 'מייל או סיסמה לא נכונים')
    } else {
      if (!name.trim()) { setErr('איך לקרוא לך?'); setBusy(false); return }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: redirect } })
      if (error) setErr(error.message.includes('registered') ? 'המייל הזה כבר רשום. עבור ל"כניסה".' : 'ההרשמה נכשלה. נסה שוב.')
      else if (!data.session) setInfo('נשלח אליך מייל לאישור הכתובת. אחרי האישור, חזור לכאן והיכנס.')
    }
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="col" style={{ gap: 20 }}>
        <Logo size={64} />
        <h1 className="hero"><span className="light">דבר אליי.</span>אתה מדבר, אני זוכר.</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>משימות, רעיונות וקניות. בקול, בכתב או בתמונה, ושום דבר לא נשכח.</p>
      </div>
      <form className="col" style={{ gap: 12 }} onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setErr('') }}>כניסה</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr('') }}>הרשמה</button>
        </div>
        {mode === 'signup' && <div className="field"><label htmlFor="nm">שם</label><input id="nm" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>}
        <div className="field"><label htmlFor="em">מייל</label><input id="em" type="email" inputMode="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="pw">סיסמה</label><input id="pw" type="password" dir="ltr" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'signup' && <span className="xs dim">לפחות 8 תווים</span>}</div>
        {err && <div className="small" style={{ color: 'var(--danger)' }}>{err}</div>}
        {info && <div className="banner">{info}</div>}
        <button className="btn lg primary block" disabled={busy}>{busy ? 'רגע...' : mode === 'signin' ? 'כניסה' : 'הרשמה'}</button>
        <div className="xs dim" style={{ textAlign: 'center', lineHeight: 1.6 }}>הכניסה בהזמנה בלבד ובאישור מנהל. מנהל המערכת יכול לצפות בנתוני שימוש מצטברים. אחרי הכניסה הראשונה תישאר מחובר.</div>
      </form>
    </div>
  )
}
