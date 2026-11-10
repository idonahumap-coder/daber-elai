import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTo } from './push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response('unauth', { status: 401, headers: cors })
    const { data: me } = await admin.from('profiles').select('display_name').eq('id', user.id).single()
    const name = me?.display_name || 'מישהו'
    const b = await req.json()

    const prefOk = async (uid: string, k: string) => {
      const { data } = await admin.from('profiles').select('notif_prefs,status').eq('id', uid).single()
      return data?.status === 'approved' && data?.notif_prefs?.[k] !== false
    }

    if (b.type === 'share' && b.task_id && b.user_id) {
      // verify the sender can access the task
      const { data: t } = await userClient.from('tasks').select('title').eq('id', b.task_id).single()
      if (t && await prefOk(b.user_id, 'share')) {
        await sendTo(admin, b.user_id, { title: b.role === 'assignee' ? `${name} הטיל/ה עליך משימה` : `${name} שיתף/ה איתך משימה`, body: `${t.title} · לחץ לאישור`, url: './#/', tag: 'share-' + b.task_id })
      }
    } else if (b.type === 'done' && b.task_id) {
      const { data: t } = await userClient.from('tasks').select('title,owner_id,assignee_id').eq('id', b.task_id).single()
      if (t) {
        const { data: mem } = await admin.from('task_members').select('user_id').eq('task_id', b.task_id).eq('status', 'accepted')
        const ids = new Set<string>([t.owner_id, ...(mem || []).map((m: { user_id: string }) => m.user_id)])
        if (t.assignee_id) ids.add(t.assignee_id)
        ids.delete(user.id)
        for (const id of ids) if (await prefOk(id, 'share')) await sendTo(admin, id, { title: `${name} סימן/ה בוצע`, body: t.title, url: './#/', tag: 'done-' + b.task_id })
      }
    } else if (b.type === 'household' && b.user_id) {
      const { data: m } = await admin.from('household_members').select('invited_by').eq('user_id', b.user_id).eq('status', 'pending').single()
      if (m?.invited_by === user.id) await sendTo(admin, b.user_id, { title: 'הזמנה לבית משותף', body: `${name} הזמין/ה אותך לבית משותף`, url: './#/household' })
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: cors })
  }
})
