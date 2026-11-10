/** Swipe down to close any bottom sheet (.sheet preceded by an .overlay that closes it) */
let sheet: HTMLElement | null = null
let y0 = 0, dy = 0, t0 = 0, active = false

document.addEventListener('touchstart', (e) => {
  const el = (e.target as HTMLElement).closest?.('.sheet') as HTMLElement | null
  if (!el || el.scrollTop > 0) return
  if ((e.target as HTMLElement).closest('input, textarea, select, .chips, [data-nodrag]')) return
  sheet = el; y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); active = false
}, { passive: true })

document.addEventListener('touchmove', (e) => {
  if (!sheet) return
  dy = e.touches[0].clientY - y0
  if (!active) {
    if (dy < 6) { if (dy < -4) sheet = null; return }
    active = true; sheet.classList.add('dragging')
  }
  if (e.cancelable) e.preventDefault()
  sheet.style.transform = `translateX(-50%) translateY(${Math.max(0, dy)}px)`
  const ov = sheet.previousElementSibling as HTMLElement | null
  if (ov?.classList.contains('overlay')) ov.style.opacity = String(Math.max(0, 1 - dy / 400))
}, { passive: false })

document.addEventListener('touchend', () => {
  const el = sheet; sheet = null
  if (!el || !active) return
  el.classList.remove('dragging'); el.classList.add('snap')
  const ov = el.previousElementSibling as HTMLElement | null
  const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.5
  if (dy > 110 || fast) {
    el.style.transform = 'translateX(-50%) translateY(110%)'
    if (ov) { ov.style.transition = 'opacity .25s'; ov.style.opacity = '0' }
    setTimeout(() => { ov?.click(); el.style.transform = ''; el.classList.remove('snap'); if (ov) { ov.style.opacity = ''; ov.style.transition = '' } }, 240)
  } else {
    el.style.transform = ''
    if (ov) ov.style.opacity = ''
    setTimeout(() => el.classList.remove('snap'), 300)
  }
})
