import { supabase } from './supabase'
import { getState } from './store'
import type { Extracted } from './types'
import { WORLD_LABEL, today, nowHM, DAY_NAMES, dow } from './dates'

export interface ExtractResult { items: Extracted[]; transcript: string }

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(b)
  })
}

export async function extract(input: { audio?: Blob; image?: Blob; text?: string }): Promise<ExtractResult> {
  const s = getState()
  const p = s.profile!
  const t = today()
  const context = {
    today: t, weekday: DAY_NAMES[dow(t)], now: nowHM(),
    worlds: p.worlds.map((w) => ({ id: w, label: WORLD_LABEL[w] })),
    shopping_worlds: p.shopping_worlds,
    categories: s.categories.map((c) => c.name),
    recent: s.tasks.slice(-40).map((x) => `${x.title} [${x.world}]`),
    facts: [] as string[],
    day_start: p.day_start.slice(0, 5), day_end: p.day_end.slice(0, 5)
  }
  const body: Record<string, unknown> = { context }
  if (input.audio) { body.audio = await blobToBase64(input.audio); body.mime = input.audio.type || 'audio/mp4' }
  if (input.image) { body.image = await blobToBase64(input.image); body.mime = input.image.type || 'image/jpeg' }
  if (input.text) body.text = input.text
  const { data, error } = await supabase.functions.invoke('extract', { body })
  if (error) {
    let msg = 'הגזירה נכשלה. נסה שוב.'
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error } catch { /* */ }
    throw new Error(msg)
  }
  return data as ExtractResult
}

export async function quota(): Promise<{ used: number; lim: number; enabled: boolean } | null> {
  const { data } = await supabase.rpc('ai_quota')
  return data?.[0] ?? null
}
