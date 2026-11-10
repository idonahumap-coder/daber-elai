import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { pushEvent, refresh, saveProfile, toast, useStore } from '../lib/store'
import { Icon } from '../components/Icon'

export default function Household() {
  const nav = useNavigate()
  const p = useStore((s) => s.profile)!
  const hh = useStore((s) => s.household)
  const people = useStore((s) => s.householdPeople)
  const users = useStore((s) => s.users)
  const [name, setName] = useState('הבית שלנו')
  const me = people.find((x) => x.id === p.id)
  const inHouse = me?.status === 'accepted'
  const invited = me?.status === 'pending'
  const candidates = users.filter((u) => !people.some((x) => x.id === u.id))

  const create = async () => {
    const { error } = await supabase.rpc('create_household', { p_name: name })
    if (error) toast('לא הצלחתי ליצור בית'); else { toast('הבית נוצר'); refresh() }
  }
  const invite = async (uid: string) => {
    const { error } = await supabase.rpc('invite_to_household', { p_user: uid })
    if (error) toast(error.message.includes('full') ? 'הבית מלא (עד 3)' : error.message.includes('already') ? 'המשתמש כבר בבית אחר' : 'ההזמנה נכשלה')
    else { pushEvent({ type: 'household', user_id: uid }); toast('ההזמנה נשלחה'); refresh() }
  }
  const leave = async () => {
    if (!confirm('לעזוב את הבית המשותף?')) return
    await supabase.rpc('leave_household')
    await saveProfile({ worlds: p.worlds.filter((w) => w !== 'home').length ? p.worlds.filter((w) => w !== 'home') : ['personal'], shopping_worlds: p.shopping_worlds.filter((w) => w !== 'home') })
    toast('עזבת את הבית'); refresh()
  }

  return (
    <div className="page">
      <div className="row"><button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)}><Icon name="back" size={18} /></button><h2 className="title grow">בית משותף</h2></div>
      {invited ? (
        <div className="card col"><div>הוזמנת לבית משותף.</div>
          <div className="row"><button className="btn primary" onClick={async () => { await supabase.rpc('respond_household', { p_accept: true }); refresh() }}>הצטרף</button>
            <button className="btn" onClick={async () => { await supabase.rpc('respond_household', { p_accept: false }); refresh() }}>לא תודה</button></div></div>
      ) : !inHouse ? (
        <div className="card col">
          <div className="muted" style={{ lineHeight: 1.6 }}>מרחב משותף לעד 3 אנשים: משימות בית, חלוקת משימות ורשימת קניות משותפת.</div>
          <div className="field"><label htmlFor="hn">שם הבית</label><input id="hn" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <button className="btn primary" onClick={create}>פתח בית משותף</button>
        </div>
      ) : (
        <>
          <div className="card col">
            <div style={{ fontWeight: 600 }}>{hh?.name}</div>
            {people.map((x) => <div key={x.id} className="row"><div className="avatar" style={{ width: 36, height: 36 }}>{x.avatar_url ? <img src={x.avatar_url} alt="" referrerPolicy="no-referrer" /> : (x.display_name || '?')[0]}</div><span className="grow">{x.id === p.id ? 'אני' : x.display_name}</span>{x.status === 'pending' && <span className="small muted">ממתין</span>}</div>)}
          </div>
          {people.length < 3 && (
            <div className="col">
              <div className="section-label">הזמן לבית</div>
              {candidates.length ? candidates.map((u) => <div key={u.id} className="row"><span className="grow">{u.display_name}</span><button className="btn sm" onClick={() => invite(u.id)}>הזמן</button></div>)
                : <div className="small muted">כדי להזמין מישהו, הוא צריך קודם להיכנס לאפליקציה ולהיות מאושר.</div>}
            </div>
          )}
          <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={leave}>עזוב את הבית</button>
        </>
      )}
    </div>
  )
}
