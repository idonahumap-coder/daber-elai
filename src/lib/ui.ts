import { useSyncExternalStore } from 'react'
import type { Extracted, World } from './types'

interface UI {
  openTaskId: string | null
  newTask: boolean
  worldFilter: 'all' | World
  extraction: { items: Extracted[]; transcript: string } | null
  extracting: boolean
}
let ui: UI = { openTaskId: null, newTask: false, worldFilter: (localStorageGet('wf') as UI['worldFilter']) || 'all', extraction: null, extracting: false }
const ls = new Set<() => void>()
function localStorageGet(k: string) { try { return localStorage.getItem(k) } catch { return null } }
export function setUI(p: Partial<UI>) {
  ui = { ...ui, ...p }
  if (p.worldFilter) { try { localStorage.setItem('wf', p.worldFilter) } catch { /* */ } }
  ls.forEach((l) => l())
}
export const getUI = () => ui
export function useUI<T>(sel: (u: UI) => T): T {
  return useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb) }, () => sel(ui))
}
