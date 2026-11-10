import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addShop, clearChecked, toggleShop, useStore } from '../lib/store'
import { Icon } from '../components/Icon'

export default function Shopping() {
  const { world } = useParams()
  const nav = useNavigate()
  const items = useStore((s) => s.shopping)
  const household = useStore((s) => s.household)
  const me = useStore((s) => s.profile!.id)
  const people = useStore((s) => s.householdPeople)
  const shared = world === 'home'
  const list = items.filter((x) => (shared ? (household ? x.household_id === household.id : x.owner_id === me && !x.household_id) : x.owner_id === me && !x.household_id))
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const open = list.filter((x) => !x.checked)
  const done = list.filter((x) => x.checked)

  const add = () => {
    const n = name.trim(); if (!n) return
    addShop(n, qty.trim() || null, shared)
    setName(''); setQty('')
  }

  return (
    <div className="page">
      <div className="row"><button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)}><Icon name="back" size={18} /></button><h2 className="title grow">קניות · {shared ? 'בית' : 'אישי'}</h2></div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="מה צריך לקנות?" aria-label="פריט" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="כמות" aria-label="כמות" style={{ width: 80 }} inputMode="numeric" />
        <button className="btn primary" disabled={!name.trim()}>הוסף</button>
      </form>
      <div className="list">
        {open.map((x) => (
          <div key={x.id} className="task" onClick={() => toggleShop(x.id)}>
            <button className="check" aria-label="סמן כנקנה" />
            <div className="grow"><div className="t-title">{x.name}{x.qty ? <span className="muted" style={{ fontWeight: 400 }}> × {x.qty}</span> : null}</div>
              {shared && x.created_by !== me && <div className="t-meta">{people.find((p) => p.id === x.created_by)?.display_name}</div>}</div>
          </div>
        ))}
      </div>
      {!open.length && <div className="empty"><div style={{ color: 'var(--text)', fontWeight: 500 }}>הרשימה ריקה.</div><div>אפשר גם להגיד "צריך לקנות חלב ולחם" בהקלטה.</div></div>}
      {done.length > 0 && (
        <div className="col" style={{ gap: 2 }}>
          <div className="between"><span className="section-label">נקנו · {done.length}</span><button className="btn sm ghost" onClick={() => clearChecked(done.map((x) => x.id))}>נקה שנקנו</button></div>
          <div className="list">{done.map((x) => (
            <div key={x.id} className="task done" onClick={() => toggleShop(x.id)}>
              <button className="check on" aria-label="החזר לרשימה"><Icon name="check" size={16} stroke={2.5} /></button>
              <div className="grow"><div className="t-title">{x.name}{x.qty ? ` × ${x.qty}` : ''}</div></div>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  )
}
