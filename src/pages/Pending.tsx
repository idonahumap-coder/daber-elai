import { supabase } from '../lib/supabase'
import { refresh, useStore } from '../lib/store'
import { Icon } from '../components/Icon'

export default function Pending() {
  const p = useStore((s) => s.profile)!
  return (
    <div className="login">
      <div className="col" style={{ gap: 20 }}>
        <div className="logo"><Icon name="clock" size={30} /></div>
        <h1 className="hero"><span className="light">כמעט שם.</span>{p.status === 'rejected' ? 'הבקשה לא אושרה.' : 'הבקשה נשלחה למנהל.'}</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {p.status === 'rejected' ? 'אם זו טעות, פנה למי שהזמין אותך.' : `נכנסת בתור ${p.email}. ברגע שהמנהל יאשר, האפליקציה תיפתח כאן.`}
        </p>
      </div>
      <div className="col">
        <button className="btn lg primary block" onClick={() => refresh()}>בדוק שוב</button>
        <button className="btn ghost block" onClick={() => supabase.auth.signOut()}>יציאה</button>
      </div>
    </div>
  )
}
