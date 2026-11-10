import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveProfile, useStore } from '../lib/store'
import { Icon } from '../components/Icon'

interface Fact { id: string; text: string; source: string; created_at: string }

export default function Learned() {
  const nav = useNavigate()
  const p = useStore((s) => s.profile)!
  const [facts, setFacts] = useState<Fact[]>([])
  const [text, setText] = useState('')
  const load = () => supabase.from('learned_facts').select('*').order('created_at', { ascending: false }).then(({ data }) => setFacts(data || []))
  useEffect(() => { load() }, [])
  const add = async () => { if (!text.trim()) return; await supabase.from('learned_facts').insert({ user_id: p.id, text: text.trim(), source: 'manual' }); setText(''); load() }
  const del = async (id: string) => { setFacts((f) => f.filter((x) => x.id !== id)); await supabase.from('learned_facts').delete().eq('id', id) }

  return (
    <div className="page">
      <div className="row"><button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)}><Icon name="back" size={18} /></button><h2 className="title grow">מה אני יודע עליך</h2></div>
      <div className="muted" style={{ lineHeight: 1.6 }}>מה שלמדתי מהדרך שבה אתה עובד. אני משתמש בזה כדי לגזור משימות טוב יותר ולתת הצעות. אפשר למחוק כל שורה, או להוסיף משהו בעצמך.</div>
      <div className="switch card"><span className="grow">למידה פעילה</span><button className={'toggle' + (p.learning_enabled ? ' on' : '')} role="switch" aria-checked={p.learning_enabled} aria-label="למידה" onClick={() => saveProfile({ learning_enabled: !p.learning_enabled })} /></div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder='למשל: "אני עובד מהבית בימי שלישי"' /><button className="btn">הוסף</button>
      </form>
      <div className="list">
        {facts.map((f) => (
          <div key={f.id} className="task">
            <Icon name={f.source === 'manual' ? 'user' : 'sparkle'} size={18} style={{ color: f.source === 'manual' ? 'var(--muted)' : 'var(--accent)' }} />
            <div className="grow t-title" style={{ fontWeight: 400 }}>{f.text}</div>
            <button className="icon-btn" style={{ border: 'none' }} aria-label="מחק" onClick={() => del(f.id)}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
      {!facts.length && <div className="empty">עוד לא למדתי כלום. אחרי שבוע של שימוש יופיעו כאן תובנות.</div>}
    </div>
  )
}
