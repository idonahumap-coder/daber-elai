import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extract } from '../lib/ai'
import { setUI } from '../lib/ui'
import { toast } from '../lib/store'
import { Icon } from './Icon'

async function shrink(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const max = 1600
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', 0.85))
  } catch { return file }
}

export default function ExtractSheet({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const gal = useRef<HTMLInputElement>(null)
  const cam = useRef<HTMLInputElement>(null)

  const go = async (input: { text?: string; image?: Blob }) => {
    setBusy(true)
    try {
      if (input.image) input.image = await shrink(input.image)
      const res = await extract(input)
      setUI({ extraction: res })
      onClose()
      nav('/review')
    } catch (e) {
      toast((e as Error).message)
    } finally { setBusy(false) }
  }

  const pasteImage = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'))
        if (type) { await go({ image: await it.getType(type) }); return }
        if (it.types.includes('text/plain')) { const t = await (await it.getType('text/plain')).text(); setText(t); return }
      }
      toast('אין תמונה או טקסט ללוח')
    } catch {
      try { const t = await navigator.clipboard.readText(); if (t) setText(t); else toast('אין מה להדביק') } catch { toast('הדבק ידנית בתיבת הטקסט') }
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) go({ image: f }); e.target.value = '' }

  return (
    <>
      <div className="overlay" onClick={busy ? undefined : onClose} />
      <div className="sheet" role="dialog" aria-label="גזור משימות">
        <div className="grabber" />
        <h2 className="title">גזור משימות</h2>
        {busy ? (
          <div className="col" style={{ alignItems: 'center', padding: 30, gap: 14 }}><div className="spinner" /><div className="muted">קורא וגוזר...</div></div>
        ) : (
          <>
            <div className="grid3">
              <button className="btn chip" style={{ height: 72, flexDirection: 'column', gap: 4 }} onClick={() => cam.current?.click()}><Icon name="camera" />צלם</button>
              <button className="btn chip" style={{ height: 72, flexDirection: 'column', gap: 4 }} onClick={() => gal.current?.click()}><Icon name="image" />מהגלריה</button>
              <button className="btn chip" style={{ height: 72, flexDirection: 'column', gap: 4 }} onClick={pasteImage}><Icon name="paste" />הדבק</button>
            </div>
            <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
            <input ref={gal} type="file" accept="image/*" hidden onChange={onFile} />
            <div className="field"><label htmlFor="xt">או הדבק טקסט (הודעה מוואטסאפ, מייל, רשימה)</label>
              <textarea id="xt" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="הדבק כאן..." /></div>
            <button className="btn lg primary" disabled={!text.trim()} onClick={() => go({ text })}>גזור משימות</button>
          </>
        )}
      </div>
    </>
  )
}
