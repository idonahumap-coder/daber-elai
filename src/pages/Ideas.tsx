import { useState } from 'react'
import { addCategory, addIdea, addTasks, deleteCategory, deleteIdea, newTask, toast, updateIdea, useStore } from '../lib/store'
import type { Idea } from '../lib/types'
import { relDay, today } from '../lib/dates'
import { Icon } from '../components/Icon'
import { setUI } from '../lib/ui'

export default function Ideas() {
  const ideas = useStore((s) => s.ideas)
  const cats = useStore((s) => s.categories)
  const profile = useStore((s) => s.profile)!
  const [cat, setCat] = useState<string | 'all' | 'none'>('all')
  const [title, setTitle] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [askFor, setAskFor] = useState<Idea | null>(null)
  const [manage, setManage] = useState(false)
  const [newCat, setNewCat] = useState('')

  const shown = ideas.filter((i) => i.status !== 'archived' && i.status !== 'converted' && (cat === 'all' || (cat === 'none' ? !i.category_id : i.category_id === cat)))
  const archived = ideas.filter((i) => i.status !== 'open')

  const add = async () => {
    if (!title.trim()) return
    const row = await addIdea({ title: title.trim() })
    setTitle('')
    setAskFor(row)
  }

  return (
    <div className="page">
      <div className="between"><h2 className="title">רעיונות</h2><button className="btn sm ghost" onClick={() => setManage((v) => !v)}>{manage ? 'סיום' : 'קטגוריות'}</button></div>

      <form className="row" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="רעיון חדש..." aria-label="רעיון חדש" />
        <button className="btn primary" disabled={!title.trim()}>שמור</button>
      </form>

      {askFor && (
        <div className="shell"><div className="core" style={{ gap: 10 }}>
          <div className="small" style={{ color: 'var(--accent)' }}>"{askFor.title}" נשמר. לשייך לקטגוריה?</div>
          <div className="chips">
            {cats.map((c) => <button key={c.id} className="chip" onClick={() => { updateIdea(askFor.id, { category_id: c.id }); setAskFor(null) }}>{c.name}</button>)}
            <button className="chip" onClick={() => setAskFor(null)}>בלי</button>
          </div>
          <div className="row"><span className="small muted grow">לשים דדליין או תזכורת?</span><button className="btn sm" onClick={() => { setOpenId(askFor.id); setAskFor(null) }}>כן</button><button className="btn sm ghost" onClick={() => setAskFor(null)}>לא</button></div>
        </div></div>
      )}

      {manage && (
        <div className="card col">
          {cats.map((c) => <div key={c.id} className="row"><span className="grow">{c.name}</span><button className="icon-btn" style={{ border: 'none' }} aria-label="מחק קטגוריה" onClick={() => deleteCategory(c.id)}><Icon name="trash" size={18} /></button></div>)}
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) { addCategory(newCat); setNewCat('') } }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="קטגוריה חדשה (פיתוחים, עסקים, רכישות...)" /><button className="btn">הוסף</button>
          </form>
        </div>
      )}

      {cats.length > 0 && (
        <div className="chips">
          <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>הכל</button>
          {cats.map((c) => <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.name}</button>)}
          <button className={'chip' + (cat === 'none' ? ' on' : '')} onClick={() => setCat('none')}>ללא</button>
        </div>
      )}

      <div className="list">
        {shown.map((i) => (
          <button key={i.id} className="task" style={{ textAlign: 'right', color: 'var(--text)', width: '100%', border: 'none', borderBottom: '1px solid var(--line)' }} onClick={() => setOpenId(i.id)}>
            <Icon name="idea" size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div className="grow">
              <div className="t-title">{i.title}</div>
              <div className="t-meta">{[cats.find((c) => c.id === i.category_id)?.name, i.deadline ? `עד ${relDay(i.deadline)}` : '', i.remind_at ? `תזכורת ${relDay(i.remind_at.slice(0, 10))}` : ''].filter(Boolean).join(' · ') || relDay(i.created_at.slice(0, 10))}</div>
            </div>
            <Icon name="chevron" size={16} style={{ color: 'var(--dim)' }} />
          </button>
        ))}
      </div>
      {!shown.length && <div className="empty"><div style={{ color: 'var(--text)', fontWeight: 500 }}>אין רעיונות עדיין.</div><div>כתוב כאן, או פשוט תגיד "יש לי רעיון ל..." בהקלטה.</div></div>}
      {archived.length > 0 && <div className="small dim">{archived.length} רעיונות הפכו למשימות או נגנזו</div>}

      {openId && <IdeaSheet idea={ideas.find((i) => i.id === openId)!} onClose={() => setOpenId(null)} worldDefault={profile.worlds[0]} />}
    </div>
  )
}

function IdeaSheet({ idea, onClose, worldDefault }: { idea: Idea; onClose: () => void; worldDefault: 'personal' | 'home' | 'work' }) {
  const cats = useStore((s) => s.categories)
  const [title, setTitle] = useState(idea.title)
  const [body, setBody] = useState(idea.body || '')
  const [cat, setCat] = useState(idea.category_id)
  const [remind, setRemind] = useState(idea.remind_at ? toLocalInput(idea.remind_at) : '')
  const [deadline, setDeadline] = useState(idea.deadline || '')
  if (!idea) return null
  const save = () => { updateIdea(idea.id, { title, body: body || null, category_id: cat, remind_at: remind ? new Date(remind).toISOString() : null, deadline: deadline || null }); toast('נשמר'); onClose() }
  const toTask = async () => {
    const t = newTask({ title, notes: body || null, world: worldDefault, kind: deadline ? 'deadline' : 'day', due_date: deadline || today() })
    await addTasks([t])
    await updateIdea(idea.id, { status: 'converted', task_id: t.id })
    toast('הפך למשימה'); onClose(); setUI({ openTaskId: t.id })
  }
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="grabber" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 20, fontWeight: 600, background: 'transparent', border: 'none', padding: '4px 0' }} aria-label="כותרת" />
        <div className="field"><label htmlFor="ib">פירוט</label><textarea id="ib" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="מה הרעיון?" /></div>
        <div className="field"><label>קטגוריה</label><div className="chips">
          {cats.map((c) => <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.name}</button>)}
          {!cats.length && <span className="small dim">אין קטגוריות. הוסף מכפתור "קטגוריות".</span>}
        </div></div>
        <div className="grid2">
          <div className="field"><label htmlFor="ir">תזכורת לחזור אליו</label><input id="ir" type="datetime-local" value={remind} onChange={(e) => setRemind(e.target.value)} /></div>
          <div className="field"><label htmlFor="idl">דדליין</label><input id="idl" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
        </div>
        <div className="grid2">
          <button className="btn lg primary" onClick={save}>שמור</button>
          <button className="btn lg" onClick={toTask}>הפוך למשימה</button>
        </div>
        <div className="grid2">
          <button className="btn ghost" onClick={() => { updateIdea(idea.id, { status: 'archived' }); onClose() }}>גנוז</button>
          <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={() => { if (confirm('למחוק את הרעיון?')) { deleteIdea(idea.id); onClose() } }}>מחק</button>
        </div>
      </div>
    </>
  )
}

function toLocalInput(iso: string) { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
