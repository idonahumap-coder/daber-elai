import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['task', 'idea', 'shopping'] },
          title: { type: 'STRING' },
          world: { type: 'STRING', enum: ['personal', 'home', 'work'] },
          kind: { type: 'STRING', enum: ['timed', 'day', 'week', 'deadline'] },
          date: { type: 'STRING', nullable: true },
          time: { type: 'STRING', nullable: true },
          priority: { type: 'INTEGER' },
          recurrence: {
            type: 'OBJECT', nullable: true,
            properties: {
              type: { type: 'STRING', enum: ['daily', 'weekdays', 'monthly', 'interval'] },
              days: { type: 'ARRAY', items: { type: 'INTEGER' } },
              day: { type: 'INTEGER' },
              every: { type: 'INTEGER' }
            }
          },
          qty: { type: 'STRING', nullable: true },
          category: { type: 'STRING', nullable: true },
          question: { type: 'STRING', nullable: true }
        },
        required: ['type', 'title', 'world']
      }
    }
  },
  required: ['transcript', 'items']
}

function prompt(ctx: Record<string, unknown>, mode: string) {
  return `אתה העוזר של אפליקציית ניהול משימות בעברית בשם "דבר אליי". קיבלת ${mode === 'audio' ? 'הקלטה קולית' : mode === 'image' ? 'תמונה (לרוב פתק או מחברת בכתב יד, או צילום מסך של הודעה)' : 'טקסט'} מהמשתמש.
המטרה: לחלץ ממנה את כל המשימות, הרעיונות ופריטי הקניות. אל תמציא דברים שלא נאמרו.

הקשר:
- היום: ${ctx.today} (יום ${ctx.weekday}), השעה עכשיו ${ctx.now}. אזור זמן ישראל. השבוע מתחיל ביום ראשון.
- העולמות של המשתמש: ${JSON.stringify(ctx.worlds)}. מותר להשתמש רק בעולמות האלה. personal=אישי, home=בית משותף (מטלות בית, משפחה, בן/בת זוג), work=עבודה.
- רשימות קניות פעילות בעולמות: ${JSON.stringify(ctx.shopping_worlds)}.
- קטגוריות רעיונות קיימות: ${JSON.stringify(ctx.categories)}.
- משימות אחרונות (לזיהוי סגנון ועולם): ${JSON.stringify(ctx.recent)}.
- שעות היום של המשתמש: ${ctx.day_start}-${ctx.day_end}.

כללים:
1. transcript: תמלול נאמן של מה שנאמר/נכתב, בעברית.
2. כל פריט: title קצר ופעיל בעברית, בצורת שם פועל ("להתקשר לרואה החשבון", "לשלם ארנונה"). בלי תאריכים ושעות בכותרת.
3. בקשת תזכורת עם זמן ("תזכיר לי עוד 16 דקות לקנות חלב", "תזכיר לי בערב לקנות לחם") היא תמיד type=task, גם אם מדובר בקנייה. ה-title הוא הפעולה בלבד ("לקנות חלב").
3א. type: task למשימה, idea לרעיון ("יש לי רעיון", "אולי כדאי", "חשבתי על"), shopping לפריט קנייה ("לקנות חלב", "נגמר הלחם"). אם אין אף רשימת קניות פעילה, הפוך את כל פריטי הקניות למשימה אחת "לקנות: ..." עם רשימת הפריטים.
4. world: נחש לפי התוכן מתוך העולמות המותרים. אם יש עולם אחד בלבד השתמש בו.
5. מועד (רק למשימות):
   - שעה מפורשת ("מחר בעשר", "ב-17:30") => kind=timed, date=YYYY-MM-DD, time=HH:MM (24 שעות; "בעשר" בבוקר=10:00 אלא אם ברור שערב).
   - יום בלי שעה ("מחר", "ביום שלישי") => kind=day עם date.
   - "השבוע", "עד סוף השבוע" בלי יום => kind=week, date=היום.
   - "עד יום X", "עד ה-20" => kind=deadline, date=התאריך.
   - "היום" => kind=day, date=היום.
   - זמן יחסי ("בעוד 16 דקות", "עוד שעה", "בעוד שעתיים") => kind=timed, date=היום, time=השעה עכשיו ועוד הזמן שנאמר (חשב בדיוק לדקה; אם עובר חצות, date=מחר).
   - אם לא נאמר מתי בכלל: date=null, time=null, kind=day, ו-question="למתי?" (או שאלה קצרה אחרת בעברית).
   - "בבוקר"=09:00, "בצהריים"=13:00, "אחר הצהריים"=16:00, "בערב"=19:00, "בלילה"=21:00.
6. חזרתיות: "כל יום" => recurrence {type:daily}; "כל ראשון ורביעי" => {type:weekdays, days:[0,3]} (0=ראשון ... 6=שבת); "כל חודש ב-10" => {type:monthly, day:10}; "כל יומיים" => {type:interval, every:2}. עם recurrence, time אם נאמרה שעה.
7. priority: 1 רגיל. 2 אם נאמר "חשוב", 3 אם "דחוף"/"חובה היום", 0 אם "לא דחוף"/"מתי שיהיה".
8. qty: רק לקניות ורק אם נאמרה כמות ("שני חלב" => "2"). אחרת null.
9. category: רק לרעיונות. הצע קטגוריה קיימת אם מתאימה, אחרת מילה אחת חדשה (פיתוחים, עסקים, רכישות, בית, טיולים...).
10. אם לא נמצא כלום, החזר items ריק.`
}

async function callGemini(key: string, parts: unknown[]) {
  const models = ['gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest']
  let lastErr = ''
  // Free tier is sometimes "overloaded" (503) for a few seconds: go over the models up to 3 times with a short pause
  for (let round = 0; round < 3; round++) {
  if (round) await new Promise((r) => setTimeout(r, 1200 * round))
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 } })
    })
    if (r.ok) return { data: await r.json(), model: m }
    lastErr += ` | ${m}: ${r.status} ${(await r.text()).slice(0, 200)}`
    if (r.status === 400 && lastErr.includes('API key')) throw new Error(lastErr)
  }
  if (!/ 503 | 429 | 500 /.test(lastErr)) break
  }
  throw new Error(lastErr)
}

// deno-lint-ignore no-explicit-any
const bg = (p: PromiseLike<unknown>) => { const pr = Promise.resolve(p); try { (globalThis as any).EdgeRuntime?.waitUntil(pr) } catch { /* */ } }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'צריך להתחבר מחדש' }, 401)

    const [{ data: p }, { data: q }] = await Promise.all([
      admin.from('profiles').select('status,ai_enabled,ai_daily_limit,is_admin').eq('id', user.id).single(),
      userClient.rpc('ai_quota')
    ])
    if (!p || p.status !== 'approved') return json({ error: 'החשבון עוד לא אושר' }, 403)
    if (!p.ai_enabled && !p.is_admin) return json({ error: 'AI לא הופעל לחשבון שלך' }, 403)
    if (!p.is_admin) {
      const used = q?.[0]?.used ?? 0
      if (used >= p.ai_daily_limit) return json({ error: `הגעת למכסה היומית (${p.ai_daily_limit} גזירות). מחר זה מתאפס.` }, 429)
    }

    const key = Deno.env.get('GEMINI_API_KEY')
    if (!key) return json({ error: 'מפתח ה-AI עוד לא הוגדר בשרת' }, 500)

    const body = await req.json()
    const ctx = body.context || {}
    const mode = body.audio ? 'audio' : body.image ? 'image' : 'text'
    const parts: unknown[] = [{ text: prompt(ctx, mode) }]
    if (body.audio) parts.push({ inline_data: { mime_type: (body.mime || 'audio/mp4').split(';')[0], data: body.audio } })
    if (body.image) parts.push({ inline_data: { mime_type: body.mime || 'image/jpeg', data: body.image } })
    if (body.text) parts.push({ text: 'הטקסט מהמשתמש:\n' + String(body.text).slice(0, 8000) })

    let result
    try {
      result = await callGemini(key, parts)
    } catch (e) {
      await admin.from('ai_usage').insert({ user_id: user.id, kind: 'extract', ok: false })
      const msg = String((e as Error).message)
      console.error(msg)
      if (msg.includes('429') || msg.includes('503')) return json({ error: 'ה-AI עמוס כרגע. נסה שוב בעוד דקה.' }, 429)
      if (msg.includes('API key')) return json({ error: 'מפתח ה-AI לא תקין' }, 500)
      return json({ error: 'הגזירה נכשלה. נסה שוב.' }, 500)
    }
    const d = result.data
    const text = d?.candidates?.[0]?.content?.parts?.filter((x: { thought?: boolean }) => !x.thought).map((x: { text?: string }) => x.text || '').join('') || '{}'
    let parsed: { transcript?: string; items?: unknown[] } = {}
    try { parsed = JSON.parse(text) } catch { parsed = { transcript: '', items: [] } }
    const u = d?.usageMetadata || {}
    bg(admin.from('ai_usage').insert({ user_id: user.id, kind: 'extract', ok: true, input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 }))
    return json({ transcript: parsed.transcript || '', items: parsed.items || [], model: result.model })
  } catch (e) {
    console.error(e)
    return json({ error: 'שגיאה בשרת' }, 500)
  }
})
