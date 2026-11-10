import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

let ready = false
export async function initPush(admin: SupabaseClient) {
  if (ready) return
  const { data } = await admin.from('app_secrets').select('key,value').in('key', ['vapid_public', 'vapid_private'])
  const m = Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]))
  webpush.setVapidDetails('mailto:admin@daber-elai.app', m.vapid_public, m.vapid_private)
  ready = true
}

export async function sendTo(admin: SupabaseClient, userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  await initPush(admin)
  const { data: subs } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push fail', code, String(e).slice(0, 200))
    }
  }
  return sent
}

/** returns true if this (user, kind, ref) was not sent before, and marks it */
export async function once(admin: SupabaseClient, userId: string, kind: string, ref: string) {
  const { error } = await admin.from('notif_log').insert({ user_id: userId, kind, ref })
  return !error
}
