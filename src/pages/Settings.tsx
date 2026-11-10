import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProfile, toast, useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { quota } from '../lib/ai'
import { enablePush, pushPermission } from '../lib/push'
import { WORLD_LABEL } from '../lib/dates'
import type { World } from '../lib/types'
import { Icon } from '../components/Icon'

const NOTIFS: [string, string][] = [['morning', 'התראת בוקר'], ['reminder', 'תזכורת לפני משימה'], ['overdue', 'משימה שחרגה מהזמן'], ['evening', 'סיכום ערב'], ['weekly', 'סיכום שבועי'], ['monthly', 'סיכום חודשי'], ['share', 'שיתופים ומשימות משותפות'], ['idea', 'תזכורות לרעיונות']]

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={'toggle' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
}

export default function Settings() {
  const p = useStore((s) => s.profile)!
  const nav = useNavigate()
  const [q, setQ] = useState<{ used: number; lim: number; enabled: boolean } | null>(null)
  const [help, setHelp] = useState(false)
  const [perm, setPerm] = useState(pushPermission())
  useEffect(() => { quota().then(setQ) }, [])

  const toggleWorld = (w: World) => {
    const has = p.worlds.includes(w)
    if (has && p.worlds.length === 1) { toast('צריך לפחות עולם אחד'); return }
    if (!has && w === 'home') { nav('/household'); return }
    saveProfile({ worlds: has ? p.worlds.filter((x) => x !== w) : [...p.worlds, w] })
  }

  return (
    <div className="page">
      <div className="row"><button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)}><Icon name="back" size={18} /></button><h2 className="title grow">הגדרות</h2></div>

      <div className="section-label">פרופיל</div>
      <div className="card col">
        <div className="field"><label htmlFor="nm">שם</label><input id="nm" defaultValue={p.display_name || ''} onBlur={(e) => e.target.value.trim() && saveProfile({ display_name: e.target.value.trim() })} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="s1">תחילת יום</label><input id="s1" type="time" defaultValue={p.day_start.slice(0, 5)} onBlur={(e) => saveProfile({ day_start: e.target.value })} /></div>
          <div className="field"><label htmlFor="s2">סוף יום</label><input id="s2" type="time" defaultValue={p.day_end.slice(0, 5)} onBlur={(e) => saveProfile({ day_end: e.target.value })} /></div>
        </div>
      </div>

      <div className="section-label">התראות</div>
      <div className="card">
        {perm !== 'granted' && <div className="switch"><span className="grow">התראות לא מופעלות בטלפון הזה</span><button className="btn sm primary" onClick={async () => { await enablePush(); setPerm(pushPermission()) }}>הפעל</button></div>}
        {NOTIFS.map(([k, l]) => <div key={k} className="switch"><span className="grow">{l}</span><Toggle label={l} on={p.notif_prefs?.[k] !== false} onChange={(v) => saveProfile({ notif_prefs: { ...p.notif_prefs, [k]: v } })} /></div>)}
        <div className="switch">
          <span className="grow row" style={{ gap: 8 }}>מצב שבת <button className="help" aria-label="מה זה" onClick={() => setHelp((v) => !v)}>?</button></span>
          <Toggle label="מצב שבת" on={p.shabbat_mode} onChange={(v) => saveProfile({ shabbat_mode: v })} />
        </div>
        {help && <div className="small muted" style={{ paddingBottom: 12, lineHeight: 1.6 }}>משישי 13:00 עד מוצאי שבת 19:00 לא תקבל שום התראה. גם בלי מצב שבת, בשישי בערב ובשבת בבוקר לא נשלחים סיכומים.</div>}
        <div className="field" style={{ paddingTop: 12 }}><label>תזכורת ברירת מחדל לפני משימה</label>
          <div className="chips">{[0, 5, 15, 30, 60].map((m) => <button key={m} className={'chip' + (p.default_reminder_min === m ? ' on' : '')} onClick={() => saveProfile({ default_reminder_min: m })}>{m === 0 ? 'בזמן' : m === 60 ? 'שעה' : `${m} דק׳`}</button>)}</div></div>
      </div>

      <div className="section-label">עולמות וקניות</div>
      <div className="card">
        {(['personal', 'home', 'work'] as World[]).map((w) => (
          <div key={w} className="switch"><span className="grow row" style={{ gap: 8 }}><span className={'dot ' + w} />{w === 'home' ? 'בית משותף' : WORLD_LABEL[w]}</span><Toggle label={WORLD_LABEL[w]} on={p.worlds.includes(w)} onChange={() => toggleWorld(w)} /></div>
        ))}
        {p.worlds.filter((w) => w !== 'work').map((w) => (
          <div key={'s' + w} className="switch"><span className="grow">רשימת קניות ב{w === 'home' ? 'בית' : 'אישי'}</span><Toggle label="קניות" on={p.shopping_worlds.includes(w)} onChange={(v) => saveProfile({ shopping_worlds: v ? [...p.shopping_worlds, w] : p.shopping_worlds.filter((x) => x !== w) })} /></div>
        ))}
      </div>

      <div className="section-label">שימוש</div>
      <div className="card col" style={{ gap: 14 }}>
        <div className="field"><label>סימון משימות</label><div className="chips">
          <button className={'chip' + (p.action_mode === 'swipe' ? ' on' : '')} onClick={() => saveProfile({ action_mode: 'swipe' })}>החלקה</button>
          <button className={'chip' + (p.action_mode === 'buttons' ? ' on' : '')} onClick={() => saveProfile({ action_mode: 'buttons' })}>כפתורים</button></div></div>
        <div className="field"><label>מראה</label><div className="chips">
          {([['auto', 'לפי הטלפון'], ['dark', 'כהה'], ['light', 'בהיר']] as const).map(([k, l]) => <button key={k} className={'chip' + (p.theme === k ? ' on' : '')} onClick={() => saveProfile({ theme: k })}>{l}</button>)}</div></div>
        <div className="switch" style={{ paddingBottom: 0 }}><span className="grow">למידה ותובנות אישיות</span><Toggle label="למידה" on={p.learning_enabled} onChange={(v) => saveProfile({ learning_enabled: v })} /></div>
      </div>

      <div className="section-label">AI</div>
      <div className="card small muted">{!q ? '...' : !q.enabled ? 'הקלטה וגזירה עם AI לא הופעלו לחשבון שלך. אפשר לבקש מהמנהל.' : q.lim >= 9999 ? 'ללא הגבלה' : `נוצלו ${q.used} מתוך ${q.lim} גזירות היום`}</div>

      <div className="section-label">חשבון · גרסה {__BUILD__}</div>
      <div className="card col">
        <button className="btn" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} />יציאה</button>
        {!p.is_admin && (p.delete_requested
          ? <div className="small muted">בקשת המחיקה נשלחה למנהל.</div>
          : <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={async () => { if (confirm('לשלוח למנהל בקשה למחיקת החשבון?')) { await supabase.rpc('request_delete'); saveProfile({ delete_requested: true }); toast('הבקשה נשלחה') } }}>בקשה למחיקת החשבון</button>)}
      </div>
    </div>
  )
}
