import { useState } from 'react'
import { refresh, saveProfile, toast, useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { enablePush, isIOS, isStandalone, pushSupported } from '../lib/push'
import type { World } from '../lib/types'
import { WORLD_LABEL } from '../lib/dates'
import { Icon } from '../components/Icon'

const STEPS = 11

export default function Onboarding() {
  const p = useStore((s) => s.profile)!
  const [step, setStep] = useState(0)
  const [name, setName] = useState(p.display_name || '')
  const [start, setStart] = useState(p.day_start.slice(0, 5))
  const [end, setEnd] = useState(p.day_end.slice(0, 5))
  const [worlds, setWorlds] = useState<World[]>(p.worlds.length ? p.worlds : ['personal'])
  const [homeMode, setHomeMode] = useState<'new' | 'join'>('new')
  const [shop, setShop] = useState<World[]>([])
  const [action, setAction] = useState(p.action_mode)
  const [recMode, setRecMode] = useState(p.record_mode)
  const [shabbat, setShabbat] = useState(true)
  const [shabbatHelp, setShabbatHelp] = useState(false)
  const [reminder, setReminder] = useState(15)
  const [perm, setPerm] = useState({ mic: false, cam: false, push: false })
  const [busy, setBusy] = useState(false)

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  const askMic = async () => { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); setPerm((x) => ({ ...x, mic: true })) } catch { toast('לא אושר. אפשר לאשר אחר כך בהגדרות הטלפון.') } }
  const askCam = async () => { try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); setPerm((x) => ({ ...x, cam: true })) } catch { toast('לא אושר. אפשר לאשר אחר כך.') } }
  const askPush = async () => { const r = await enablePush(); if (r === 'granted') setPerm((x) => ({ ...x, push: true })); else toast(r === 'unsupported' ? 'קודם צריך להוסיף את האפליקציה למסך הבית' : 'ההתראות לא אושרו. אפשר להפעיל אחר כך מדף הבית.') }

  const finish = async () => {
    setBusy(true)
    try {
      if (worlds.includes('home')) {
        if (homeMode === 'new') await supabase.rpc('create_household', { p_name: 'הבית שלנו' })
        else await supabase.rpc('respond_household', { p_accept: true })
      }
    } catch { /* already in household */ }
    await saveProfile({
      display_name: name.trim() || p.display_name, day_start: start, day_end: end, worlds, shopping_worlds: shop.filter((w) => worlds.includes(w)),
      action_mode: action, record_mode: recMode, shabbat_mode: shabbat, default_reminder_min: reminder, onboarded: true
    })
    await refresh()
    setBusy(false)
  }

  const toggleWorld = (w: World) => setWorlds((x) => (x.includes(w) ? (x.length > 1 ? x.filter((y) => y !== w) : x) : [...x, w]))
  const toggleShop = (w: World) => setShop((x) => (x.includes(w) ? x.filter((y) => y !== w) : [...x, w]))

  const Opt = ({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub?: string }) => (
    <button className={'option' + (on ? ' on' : '')} onClick={onClick}><span className="radio" /><span className="grow"><div style={{ fontWeight: 500 }}>{title}</div>{sub && <div className="small muted">{sub}</div>}</span></button>
  )

  const screens = [
    <>
      <div className="logo"><Icon name="mic" size={32} stroke={1.75} /></div>
      <h1 className="hero"><span className="light">ברוך הבא.</span>בוא נכיר בדקה.</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>כמה שאלות קצרות, כדי שאדע מתי לפנות אליך ואיך נוח לך לעבוד. הכל ניתן לשינוי אחר כך.</p>
    </>,
    <>
      <h2 className="title">איך לקרוא לך?</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="השם שלך" aria-label="שם" autoFocus />
    </>,
    <>
      <h2 className="title">קצת עליך</h2>
      <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>כדי שאדע מתי לפנות אליך ומתי לתת לך שקט: באיזו שעה היום שלך מתחיל, ובאיזו שעה אתה סוגר אותו?</p>
      <div className="grid2">
        <div className="field"><label htmlFor="ds">היום מתחיל</label><input id="ds" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label htmlFor="de">היום נסגר</label><input id="de" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="small dim">בתחילת היום תקבל את משימות היום, ובסוף היום סיכום.</div>
    </>,
    <>
      <h2 className="title">אילו עולמות לפתוח?</h2>
      <div className="col">
        {(['personal', 'home', 'work'] as World[]).map((w) => (
          <button key={w} className={'option' + (worlds.includes(w) ? ' on' : '')} onClick={() => toggleWorld(w)}>
            <span className="radio" /><span className={'dot ' + w} /><span className="grow" style={{ fontWeight: 500 }}>{w === 'home' ? 'בית משותף' : WORLD_LABEL[w]}</span>
          </button>
        ))}
      </div>
      {worlds.includes('home') && (
        <div className="col">
          <div className="small muted">בית משותף הוא מרחב לעד 3 אנשים, עם משימות וקניות משותפות.</div>
          <div className="chips">
            <button className={'chip' + (homeMode === 'new' ? ' on' : '')} onClick={() => setHomeMode('new')}>פתח בית חדש</button>
            <button className={'chip' + (homeMode === 'join' ? ' on' : '')} onClick={() => setHomeMode('join')}>כבר הזמינו אותי</button>
          </div>
        </div>
      )}
    </>,
    <>
      <h2 className="title">רשימת קניות?</h2>
      <p className="muted" style={{ margin: 0 }}>אפשר לפתוח רשימת קניות בתוך עולם. כשתגיד "צריך לקנות חלב", זה יגיע לשם.</p>
      <div className="col">
        {worlds.filter((w) => w !== 'work').map((w) => (
          <button key={w} className={'option' + (shop.includes(w) ? ' on' : '')} onClick={() => toggleShop(w)}><span className="radio" /><span className="grow">קניות ב{w === 'home' ? 'בית המשותף' : 'עולם האישי'}</span></button>
        ))}
        {!worlds.some((w) => w !== 'work') && <div className="small dim">אפשר לפתוח רשימת קניות רק בעולם אישי או בבית.</div>}
      </div>
    </>,
    <>
      <h2 className="title">איך נוח לך לסמן משימות?</h2>
      <Opt on={action === 'swipe'} onClick={() => setAction('swipe')} title="החלקה" sub="שמאלה = ביצעתי, ימינה = דחה" />
      {action === 'swipe' && <div className="demo"><div className="bar"><span className="check" />לשלם ארנונה</div><span style={{ marginInlineStart: 'auto', padding: 12, color: 'var(--ok)', fontSize: 13, fontWeight: 600 }}>ביצעתי</span></div>}
      <Opt on={action === 'buttons'} onClick={() => setAction('buttons')} title="כפתורים" sub="לחיצה על משימה פותחת ביצעתי, שנה, דחה, בטל" />
    </>,
    <>
      <h2 className="title">איך להקליט?</h2>
      <Opt on={recMode === 'toggle'} onClick={() => setRecMode('toggle')} title="לחיצה להתחלה, לחיצה לסיום" sub="מומלץ" />
      <Opt on={recMode === 'hold'} onClick={() => setRecMode('hold')} title="לחוץ והחזק" sub="מקליט כל עוד האצבע על הכפתור" />
    </>,
    <>
      <div className="row"><h2 className="title grow">מצב שבת</h2><button className="help" aria-label="מה זה" onClick={() => setShabbatHelp((v) => !v)}>?</button></div>
      {shabbatHelp && <div className="banner">משישי 13:00 עד מוצאי שבת 19:00 לא תקבל שום התראה. גם בלי מצב שבת, בשישי בערב ובשבת בבוקר לא נשלחים סיכומים, רק תזכורות שקבעת.</div>}
      <Opt on={shabbat} onClick={() => setShabbat(true)} title="מעוניין" />
      <Opt on={!shabbat} onClick={() => setShabbat(false)} title="לא מעוניין" />
    </>,
    <>
      <h2 className="title">תזכורת לפני משימה</h2>
      <p className="muted" style={{ margin: 0 }}>למשימות עם שעה. אפשר לשנות לכל משימה בנפרד.</p>
      <div className="chips">{[5, 15, 30, 60].map((m) => <button key={m} className={'chip' + (reminder === m ? ' on' : '')} onClick={() => setReminder(m)}>{m === 60 ? 'שעה' : `${m} דקות`}</button>)}</div>
    </>,
    <>
      <h2 className="title">הרשאות</h2>
      {isIOS() && !isStandalone() && (
        <div className="banner" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <b>כדי לקבל התראות באייפון:</b>
          <span>1. לחץ על כפתור השיתוף בספארי (ריבוע עם חץ)</span>
          <span>2. בחר "הוסף למסך הבית"</span>
          <span>3. פתח את האפליקציה מהמסך הבית והתחבר שוב</span>
        </div>
      )}
      <div className="card"><div className="switch"><div className="grow"><div style={{ fontWeight: 500 }}>מיקרופון</div><div className="small muted">כדי שתוכל לדבר אליי</div></div><button className="btn sm" onClick={askMic} disabled={perm.mic}>{perm.mic ? 'אושר' : 'אשר'}</button></div>
        <div className="switch"><div className="grow"><div style={{ fontWeight: 500 }}>מצלמה</div><div className="small muted">כדי לצלם פתקים ומחברות</div></div><button className="btn sm" onClick={askCam} disabled={perm.cam}>{perm.cam ? 'אושר' : 'אשר'}</button></div>
        <div className="switch"><div className="grow"><div style={{ fontWeight: 500 }}>התראות</div><div className="small muted">תזכורות, בוקר וסיכומים</div></div><button className="btn sm" onClick={askPush} disabled={perm.push || !pushSupported()}>{perm.push ? 'אושר' : pushSupported() ? 'אשר' : 'לא זמין'}</button></div></div>
    </>,
    <>
      <div className="logo"><Icon name="check" size={30} stroke={2} /></div>
      <h1 className="hero"><span className="light">מוכן.</span>בוא נתחיל.</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>לחץ על המיקרופון וספר לי מה עליך היום. אני אסדר את זה למשימות, ואתה רק תאשר.</p>
    </>
  ]

  return (
    <div className="login">
      <div className="col" style={{ gap: 18 }}>
        <div className="step-dots">{Array.from({ length: STEPS }).map((_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
        {screens[step]}
      </div>
      <div className="row">
        {step > 0 && <button className="btn" onClick={back}>חזרה</button>}
        {step < STEPS - 1
          ? <button className="btn lg primary grow" onClick={next}>המשך</button>
          : <button className="btn lg primary grow" onClick={finish} disabled={busy}>{busy ? 'רגע...' : 'יאללה'}</button>}
      </div>
    </div>
  )
}
