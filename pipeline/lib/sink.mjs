// Punto único de escritura de pistas. Cada adaptador llama a sink.add() con
// datos "en bruto" de su fuente; aquí se resuelve el país, se clasifica en la
// taxonomía y se hace upsert por (source_id, source_key). Al terminar, las
// pistas de esa fuente que no aparecieron en esta ejecución se eliminan.

import { classify } from './taxonomy.mjs'
import { now } from './db.mjs'

export function createSink(ctx) {
  const { db, sourceId, resolver, runId } = ctx
  const ts = now()
  const seen = new Set()
  const stats = { added: 0, images: 0, byMethod: {} }

  const upsert = db.prepare(`
    INSERT INTO hints (source_id, source_key, url, country_code, country_raw, region,
      category, subcategory, category_method, source_label, title, text, lang,
      location_url, lat, lng, extra, run_id, first_seen, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id, source_key) DO UPDATE SET
      url=excluded.url, country_code=excluded.country_code, country_raw=excluded.country_raw,
      region=excluded.region, category=excluded.category, subcategory=excluded.subcategory,
      category_method=excluded.category_method, source_label=excluded.source_label,
      title=excluded.title, text=excluded.text, lang=excluded.lang,
      location_url=excluded.location_url, lat=excluded.lat, lng=excluded.lng,
      extra=excluded.extra, run_id=excluded.run_id, updated_at=excluded.updated_at
    RETURNING id`)
  const delImages = db.prepare('DELETE FROM hint_images WHERE hint_id = ?')
  const addImage = db.prepare('INSERT INTO hint_images (hint_id, ord, url) VALUES (?, ?, ?)')

  /**
   * @param {object} h
   * @param {string} h.key           clave estable dentro de la fuente
   * @param {string} [h.url]         página de origen
   * @param {string} [h.country]     nombre/código del país como venga
   * @param {string} [h.countryCode] código ISO ya conocido (tiene prioridad)
   * @param {string} [h.region]
   * @param {string} [h.label]       etiqueta usada para clasificar
   * @param {string} [h.sourceLabel] etiqueta a guardar si difiere de la de clasificación
   * @param {string} [h.fallbackLabel] etiqueta genérica, último recurso para clasificar
   * @param {string[]} [h.tags]
   * @param {{category: string, subcategory?: string}} [h.category] forzar categoría
   * @param {string} [h.title]
   * @param {string} [h.text]
   * @param {string[]} [h.images]
   * @param {string} [h.locationUrl]
   * @param {number} [h.lat] @param {number} [h.lng]
   * @param {object} [h.extra]
   */
  function add(h) {
    if (seen.has(h.key)) return
    seen.add(h.key)

    let code = h.countryCode?.toLowerCase() ?? null
    let region = h.region ?? null
    // un código que no existe en la base (p. ej. "UK") se trata como nombre
    if (code && !resolver.has(code)) code = null
    if (!code && (h.country || h.countryCode)) {
      const r = resolver.resolve(h.country ?? h.countryCode)
      code = r.code
      region = region ?? r.region
    }

    const cls = h.category
      ? { category: h.category.category, subcategory: h.category.subcategory ?? null, method: 'label' }
      : classify({ label: h.label, tags: h.tags, text: h.text, fallbackLabel: h.fallbackLabel })
    stats.byMethod[cls.method] = (stats.byMethod[cls.method] ?? 0) + 1

    const text = h.text?.trim() || null
    const { id } = upsert.get(
      sourceId, h.key, h.url ?? null, code, h.country ?? h.countryCode ?? null, region,
      cls.category, cls.subcategory, cls.method, h.sourceLabel ?? h.label ?? null, h.title ?? null, text,
      h.lang ?? 'en', h.locationUrl ?? null, h.lat ?? null, h.lng ?? null,
      h.extra ? JSON.stringify(h.extra) : null, runId, ts, ts,
    )
    delImages.run(id)
    const images = [...new Set((h.images ?? []).filter(Boolean))]
    images.forEach((url, i) => addImage.run(id, i, url))
    stats.added++
    stats.images += images.length
  }

  const upsertAttr = db.prepare(`
    INSERT INTO attributes (source_id, attribute, country_raw, value, country_code, region, detail, url, run_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id, attribute, country_raw, value) DO UPDATE SET
      country_code=excluded.country_code, region=excluded.region, detail=excluded.detail,
      url=excluded.url, run_id=excluded.run_id`)
  stats.attributes = 0

  /** Registra un dato estructurado país → valor. */
  function attribute({ attribute, country, value, detail, url }) {
    if (!country || value == null || value === '') return
    const r = resolver.resolve(country)
    upsertAttr.run(
      sourceId, attribute, String(country), String(value), r.code, r.region,
      detail ? JSON.stringify(detail) : null, url ?? null, runId,
    )
    stats.attributes++
  }

  if (!db.prepare('PRAGMA table_info(resources)').all().some((c) => c.name === 'note'))
    db.exec('ALTER TABLE resources ADD COLUMN note TEXT')
  const upsertRes = db.prepare(`
    INSERT INTO resources (source_id, country_code, url, title, author, note, kind, run_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id, country_code, url) DO UPDATE SET title=excluded.title,
      author=excluded.author, note=excluded.note, kind=excluded.kind, run_id=excluded.run_id`)
  stats.resources = 0

  /** Registra un recurso externo recomendado (mapa, guía, hoja de cálculo…). */
  function resource({ country, countryCode, url, title, author, note, kind }) {
    if (!url) return
    const code = countryCode?.toLowerCase() ?? (country ? resolver.resolve(country).code : null)
    upsertRes.run(sourceId, code ?? '', url, title ?? null, author ?? null, note ?? null, kind ?? 'other', runId)
    stats.resources++
  }

  /** Elimina pistas, atributos y recursos de esta fuente que ya no existen en el origen. */
  function finish() {
    const r = db.prepare('DELETE FROM hints WHERE source_id = ? AND run_id <> ?').run(sourceId, runId)
    db.prepare('DELETE FROM attributes WHERE source_id = ? AND run_id <> ?').run(sourceId, runId)
    db.prepare('DELETE FROM resources WHERE source_id = ? AND run_id <> ?').run(sourceId, runId)
    stats.removed = Number(r.changes)
    return stats
  }

  return { add, attribute, resource, finish, stats }
}
