import { supabase, VAPID_PUBLIC } from './supabase'

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const pushPermission = () => (pushSupported() ? Notification.permission : 'unsupported')

export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported'
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC) })
    const j = sub.toJSON()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'error'
    await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: j.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth }, { onConflict: 'endpoint' })
    return 'granted'
  } catch (e) {
    console.error(e)
    return 'error'
  }
}

/** keep subscription fresh if permission already granted */
export async function syncPush() {
  if (pushPermission() === 'granted') await enablePush()
}
