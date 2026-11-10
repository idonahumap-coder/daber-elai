/** Short, soft "success" chime, synthesized (no file to load) */
let ctx: AudioContext | null = null
export function ding() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    const out = ctx.createGain(); out.gain.value = 0.18; out.connect(ctx.destination)
    ;[[880, 0], [1318.5, 0.09]].forEach(([f, d]) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(1, t + d + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.45)
      o.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.5)
    })
  } catch { /* no audio */ }
}
