// Datos de cada usuario (Neon, worker/src/db/study.sql): su estudio.
//
//   POST /api/me/sync   { since, decks, items, cards, reviews, settings }
//                       → { cursor, decks, items, cards, reviews, settings }
//
// Una sola petición sube los cambios del dispositivo y baja los de los demás desde `since`
// (el cursor de la sincronización anterior). Todo va en una transacción de Neon por HTTP:
// un único viaje. En mazos, guardados, tarjetas y ajustes gana el cambio más reciente
// (updated_at); los repasos solo se añaden.

import { neon } from '@neondatabase/serverless'

const MAX = 2000 // filas por tipo y sincronización (el cliente manda el resto en la siguiente)
const LIMITS = { key: 300, name: 120, note: 4000, data: 12_000 }
// la primera sincronización trae los repasos de este último periodo (bastan para las estadísticas)
const REVIEW_WINDOW_MS = 400 * 86_400_000
// solape del cursor: lo que otra petición confirme a la vez no se pierde (repetirlo no importa)
const OVERLAP_MS = 5_000

const str = (v, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)
const num = (v) => (Number.isFinite(v) ? Math.round(v) : null)

/** Lo que manda el cliente, validado y recortado (una fila mal formada se descarta). */
function clean(body) {
  const list = (x) => (Array.isArray(x) ? x.slice(0, MAX) : [])
  const decks = list(body.decks)
    .map((d) => ({ id: str(d?.id, LIMITS.key), name: str(d?.name, LIMITS.name), updated_at: num(d?.updated_at), deleted: Boolean(d?.deleted) }))
    .filter((d) => d.id && d.name && d.updated_at)
  const items = list(body.items)
    .map((i) => {
      const data = i?.data && typeof i.data === 'object' ? JSON.stringify(i.data) : null
      return {
        key: str(i?.key, LIMITS.key), kind: str(i?.kind, 20), cc: str(i?.cc, 10),
        decks: Array.isArray(i?.decks) ? i.decks.map((d) => str(d, LIMITS.key)).filter(Boolean).slice(0, 50) : [],
        note: typeof i?.note === 'string' ? i.note.slice(0, LIMITS.note) : '',
        data: data && data.length <= LIMITS.data ? data : null,
        created_at: num(i?.created_at), updated_at: num(i?.updated_at), deleted: Boolean(i?.deleted),
      }
    })
    .filter((i) => i.key && i.kind && i.data && i.created_at && i.updated_at)
  const cards = list(body.cards)
    .map((c) => ({ key: str(c?.key, LIMITS.key), state: c?.state && typeof c.state === 'object' ? JSON.stringify(c.state) : null, due: str(c?.state?.due, 40), updated_at: num(c?.updated_at) }))
    .filter((c) => c.key && c.state && c.state.length <= 2000 && c.updated_at)
  const reviews = list(body.reviews)
    .map((r) => ({ id: str(r?.id, 64), card: str(r?.card, LIMITS.key), cc: str(r?.cc, 10), answer: str(r?.answer, 10), rating: num(r?.rating), ms: num(r?.ms), at: num(r?.at) }))
    .filter((r) => r.id && r.card && r.rating >= 1 && r.rating <= 4 && r.at)
  const s = body.settings
  const settings = s && typeof s === 'object' && num(s.updated_at) ? { data: JSON.stringify(s.data ?? {}).slice(0, 4000), updated_at: num(s.updated_at) } : null
  const since = typeof body.since === 'string' && !Number.isNaN(Date.parse(body.since)) ? body.since : null
  return { decks, items, cards, reviews, settings, since }
}

/** Sube los cambios y baja los nuevos. */
export async function sync(env, userId, body) {
  const { decks, items, cards, reviews, settings, since } = clean(body)
  const sql = neon(env.DATABASE_URL)
  const from = since ?? '1970-01-01T00:00:00Z'
  const reviewsFrom = since ? 0 : Date.now() - REVIEW_WINDOW_MS
  const queries = [
    sql.query(
      `INSERT INTO study_deck (user_id, id, name, updated_at, deleted)
       SELECT $1, d.id, d.name, d.updated_at, d.deleted FROM jsonb_to_recordset($2::jsonb) AS d(id text, name text, updated_at bigint, deleted boolean)
       ON CONFLICT (user_id, id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, synced_at = now()
       WHERE study_deck.updated_at < EXCLUDED.updated_at`,
      [userId, JSON.stringify(decks)],
    ),
    sql.query(
      `INSERT INTO study_item (user_id, key, kind, cc, decks, note, data, created_at, updated_at, deleted)
       SELECT $1, i.key, i.kind, i.cc, i.decks, i.note, i.data::jsonb, i.created_at, i.updated_at, i.deleted
       FROM jsonb_to_recordset($2::jsonb) AS i(key text, kind text, cc text, decks text[], note text, data text, created_at bigint, updated_at bigint, deleted boolean)
       ON CONFLICT (user_id, key) DO UPDATE SET kind = EXCLUDED.kind, cc = EXCLUDED.cc, decks = EXCLUDED.decks, note = EXCLUDED.note, data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, synced_at = now()
       WHERE study_item.updated_at < EXCLUDED.updated_at`,
      [userId, JSON.stringify(items)],
    ),
    sql.query(
      `INSERT INTO study_card (user_id, key, state, due, updated_at)
       SELECT $1, c.key, c.state::jsonb, c.due::timestamptz, c.updated_at FROM jsonb_to_recordset($2::jsonb) AS c(key text, state text, due text, updated_at bigint)
       ON CONFLICT (user_id, key) DO UPDATE SET state = EXCLUDED.state, due = EXCLUDED.due, updated_at = EXCLUDED.updated_at, synced_at = now()
       WHERE study_card.updated_at < EXCLUDED.updated_at`,
      [userId, JSON.stringify(cards)],
    ),
    sql.query(
      `INSERT INTO study_review (user_id, id, card, cc, answer, rating, ms, at)
       SELECT $1, r.id, r.card, r.cc, r.answer, r.rating, r.ms, r.at FROM jsonb_to_recordset($2::jsonb) AS r(id text, card text, cc text, answer text, rating smallint, ms integer, at bigint)
       ON CONFLICT (user_id, id) DO NOTHING`,
      [userId, JSON.stringify(reviews)],
    ),
    settings
      ? sql.query(
          `INSERT INTO study_settings (user_id, data, updated_at) VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, synced_at = now()
           WHERE study_settings.updated_at < EXCLUDED.updated_at`,
          [userId, settings.data, settings.updated_at],
        )
      : sql.query('SELECT 1'),
    // lo cambiado desde la última vez (incluido lo que este dispositivo acaba de subir: el cliente lo ignora si ya lo tiene)
    sql.query('SELECT id, name, updated_at, deleted FROM study_deck WHERE user_id = $1 AND synced_at > $2', [userId, from]),
    sql.query('SELECT key, kind, cc, decks, note, data, created_at, updated_at, deleted FROM study_item WHERE user_id = $1 AND synced_at > $2', [userId, from]),
    sql.query('SELECT key, state, updated_at FROM study_card WHERE user_id = $1 AND synced_at > $2', [userId, from]),
    sql.query('SELECT id, card, cc, answer, rating, ms, at FROM study_review WHERE user_id = $1 AND synced_at > $2 AND at > $3', [userId, from, reviewsFrom]),
    sql.query('SELECT data, updated_at FROM study_settings WHERE user_id = $1 AND synced_at > $2', [userId, from]),
    sql.query('SELECT now() AS now'),
  ]
  const r = await sql.transaction(queries)
  const [deckRows, itemRows, cardRows, reviewRows, settingRows, [{ now }]] = r.slice(5)
  const n = (v) => Number(v) // bigint de Postgres llega como texto
  return {
    cursor: new Date(new Date(now).getTime() - OVERLAP_MS).toISOString(),
    decks: deckRows.map((d) => ({ ...d, updated_at: n(d.updated_at) })),
    items: itemRows.map((i) => ({ ...i, created_at: n(i.created_at), updated_at: n(i.updated_at) })),
    cards: cardRows.map((c) => ({ ...c, updated_at: n(c.updated_at) })),
    reviews: reviewRows.map((x) => ({ ...x, at: n(x.at) })),
    settings: settingRows[0] ? { data: settingRows[0].data, updated_at: n(settingRows[0].updated_at) } : null,
  }
}

/** Enruta /api/me/… (ya con sesión comprobada). */
export async function handleMe(request, env, user) {
  const url = new URL(request.url)
  if (url.pathname !== '/api/me/sync' || request.method !== 'POST') return Response.json({ error: 'ruta desconocida' }, { status: 404 })
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'cuerpo no válido' }, { status: 400 })
  }
  try {
    return Response.json(await sync(env, user.id, body), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    console.error(`[me] sync: ${e?.message ?? e}`)
    return Response.json({ error: 'no se pudo sincronizar' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
