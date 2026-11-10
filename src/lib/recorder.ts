/** Shared microphone recorder (used by the record screen and the hold-to-talk button) */
export const MAX_SEC = 180

function pickMime() {
  const c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  for (const m of c) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  return ''
}

export interface Rec {
  stop: () => Promise<Blob | null>
  cancel: () => void
  onLevel: (cb: (v: number) => void) => void
  startedAt: number
}

let actx: AudioContext | null = null
function audioCtx() {
  try { if (!actx) actx = new AudioContext(); if (actx.state === 'suspended') actx.resume().catch(() => {}) } catch { actx = null }
  return actx
}
function getStream() {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
}
/** Ask for microphone permission up front (closes the mic right away) */
export async function primeMic() {
  try { const s = await getStream(); s.getTracks().forEach((t) => t.stop()); return true } catch { return false }
}

export async function startRecording(): Promise<Rec> {
  const stream = await getStream()
  const mime = pickMime()
  const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 })
  const chunks: Blob[] = []
  r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  r.start(500)
  let levelCb: ((v: number) => void) | null = null
  let raf = 0
  let src: MediaStreamAudioSourceNode | null = null
  try {
    const ctx = audioCtx()!
    const an = ctx.createAnalyser(); an.fftSize = 64
    src = ctx.createMediaStreamSource(stream); src.connect(an)
    const data = new Uint8Array(an.frequencyBinCount)
    const loop = () => { an.getByteFrequencyData(data); levelCb?.(data.reduce((a, b) => a + b, 0) / data.length); raf = requestAnimationFrame(loop) }
    loop()
  } catch { /* no analyser */ }
  const cleanup = () => { cancelAnimationFrame(raf); try { src?.disconnect() } catch { /* */ } stream.getTracks().forEach((t) => t.stop()) }
  const timer = window.setTimeout(() => { if (r.state !== 'inactive') r.stop() }, MAX_SEC * 1000)
  return {
    startedAt: Date.now(),
    onLevel: (cb) => { levelCb = cb },
    cancel: () => { clearTimeout(timer); try { r.onstop = null; r.stop() } catch { /* */ } cleanup() },
    stop: () => new Promise((resolve) => {
      clearTimeout(timer)
      let finished = false
      const done = () => {
        if (finished) return
        finished = true
        cleanup()
        const b = new Blob(chunks, { type: (r.mimeType || mime || 'audio/mp4').split(';')[0] })
        resolve(b.size > 1500 ? b : null)
      }
      if (r.state === 'inactive') return done()
      r.onstop = () => setTimeout(done, 50)
      try { r.requestData() } catch { /* */ }
      try { r.stop() } catch { done() }
      setTimeout(done, 1500) // iOS sometimes never fires "stop"
    })
  }
}
