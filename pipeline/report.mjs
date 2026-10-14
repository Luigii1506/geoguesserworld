// Informe del estado de la base: qué hay, de dónde viene y dónde faltan
// datos. Se imprime y se guarda en data/REPORT.md.

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './lib/paths.mjs'

export function report(db) {
  const q = (sql, ...p) => db.prepare(sql).all(...p)
  const one = (sql, ...p) => db.prepare(sql).get(...p)
  const lines = []
  const out = (s = '') => lines.push(s)

  const totals = one(`SELECT
      (SELECT COUNT(*) FROM hints) hints,
      (SELECT COUNT(*) FROM hint_images) images,
      (SELECT COUNT(*) FROM attributes) attributes,
      (SELECT COUNT(DISTINCT country_code) FROM hints WHERE country_code IS NOT NULL) countries,
      (SELECT COUNT(*) FROM countries) base`)

  out(`# Informe de la base de conocimiento`)
  out(`Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
  out()
  out(`- **${totals.hints.toLocaleString()}** pistas · **${totals.images.toLocaleString()}** imágenes · **${totals.attributes.toLocaleString()}** atributos`)
  out(`- **${totals.countries}** países con pistas · **${totals.base}** países en la base global`)
  out()

  const hasClusters = one("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'clusters'").n > 0
  if (hasClusters) {
    const d = one(`SELECT COUNT(*) groups, SUM(size > 1) multi, SUM(source_count > 1) multisrc,
        SUM(source_count >= 3) three FROM clusters`)
    out(`## Deduplicación`)
    out(`- **${d.groups.toLocaleString()}** grupos únicos (de ${totals.hints.toLocaleString()} pistas: ${(totals.hints - d.groups).toLocaleString()} repetidas)`)
    out(`- ${d.multi.toLocaleString()} grupos con repeticiones · ${d.multisrc.toLocaleString()} confirmados por 2+ fuentes · ${d.three} por 3+`)
    const lv = q('SELECT level, COUNT(*) n FROM clusters WHERE level IS NOT NULL GROUP BY level ORDER BY level')
    const names = { 1: 'imprescindible', 2: 'común', 3: 'de país', 4: 'experto' }
    out(`- Nivel (según mapas de Learnable Meta): ${lv.map((r) => `${names[r.level]} ${r.n}`).join(' · ')}`)
    out()
    out(`Coincidencias entre fuentes (grupos que comparten):`)
    const pairs = new Map()
    for (const c of q('SELECT sources FROM clusters WHERE source_count > 1')) {
      const s = JSON.parse(c.sources)
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++) {
          const k = `${s[i]} ↔ ${s[j]}`
          pairs.set(k, (pairs.get(k) ?? 0) + 1)
        }
    }
    for (const [k, n] of [...pairs].sort((a, b) => b[1] - a[1])) out(`- ${k}: ${n}`)
    out()

    const hasReview = one("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'hint_review'").n > 0
    if (hasReview) {
      const r = one(`SELECT COUNT(*) total, SUM(reviewed) reviewed,
          SUM(quality = 'ok') ok, SUM(quality = 'junk') junk, SUM(quality = 'global') global,
          SUM(region IS NOT NULL) withRegion,
          SUM(usefulness = 3) u3, SUM(usefulness = 2) u2, SUM(usefulness = 1) u1
        FROM clusters`)
      out(`## Base limpia (revisión con DeepSeek)`)
      out(`- Grupos revisados: ${r.reviewed.toLocaleString()} de ${r.total.toLocaleString()} (el resto son solo imagen, sin texto que revisar)`)
      out(`- Calidad: ${r.ok.toLocaleString()} útiles · ${r.junk} basura · ${r.global} datos globales (excluidos de la exportación)`)
      out(`- Utilidad: ${r.u3} determinantes · ${r.u2.toLocaleString()} útiles · ${r.u1.toLocaleString()} detalle`)
      out(`- Con región concreta: ${r.withRegion.toLocaleString()}`)
      out()
      out(`| Categoría | Grupos útiles | Determinantes | Con región |`)
      out(`|---|---:|---:|---:|`)
      for (const c of q(`SELECT cat.name, COUNT(cl.id) n, SUM(cl.usefulness = 3) u3, SUM(cl.region IS NOT NULL) reg
          FROM categories cat LEFT JOIN clusters cl ON cl.category = cat.id AND COALESCE(cl.quality, 'ok') = 'ok'
          GROUP BY cat.id ORDER BY cat.ord`)) {
        out(`| ${c.name} | ${c.n} | ${c.u3 ?? 0} | ${c.reg ?? 0} |`)
      }
      out()
    }
  }

  out(`## Por fuente`)
  out(`| Fuente | Pistas | Imágenes | Atributos | Países | Sin país | Clasificación (etiqueta/tag/texto/sección/ninguna) |`)
  out(`|---|---:|---:|---:|---:|---:|---|`)
  for (const s of q('SELECT id, name FROM sources ORDER BY id')) {
    if (s.id === 'countries') continue
    const r = one(`SELECT COUNT(*) n,
        COUNT(DISTINCT country_code) c,
        SUM(country_code IS NULL) nocountry,
        SUM(category_method='label') l, SUM(category_method='tag') t,
        SUM(category_method='text') x, SUM(category_method='section') s, SUM(category_method='none') z
      FROM hints WHERE source_id = ?`, s.id)
    const img = one('SELECT COUNT(*) n FROM hint_images i JOIN hints h ON h.id=i.hint_id WHERE h.source_id=?', s.id).n
    const attr = one('SELECT COUNT(*) n FROM attributes WHERE source_id=?', s.id).n
    out(`| ${s.name} | ${r.n} | ${img} | ${attr} | ${r.c} | ${r.nocountry ?? 0} | ${r.l ?? 0}/${r.t ?? 0}/${r.x ?? 0}/${r.s ?? 0}/${r.z ?? 0} |`)
  }
  out()

  out(`## Por categoría`)
  out(`| Categoría | Pistas | Imágenes | Fuentes |`)
  out(`|---|---:|---:|---|`)
  for (const c of q(`SELECT c.id, c.name, COUNT(DISTINCT h.id) n, COUNT(i.url) imgs,
        GROUP_CONCAT(DISTINCT h.source_id) srcs
      FROM categories c LEFT JOIN hints h ON h.category = c.id
      LEFT JOIN hint_images i ON i.hint_id = h.id
      GROUP BY c.id ORDER BY c.ord`)) {
    out(`| ${c.name} (\`${c.id}\`) | ${c.n} | ${c.imgs} | ${c.srcs ?? '—'} |`)
  }
  out()

  out(`## Atributos estructurados (país → valor)`)
  for (const a of q(`SELECT source_id, attribute, COUNT(*) n, COUNT(DISTINCT country_code) c,
      COUNT(DISTINCT value) v FROM attributes GROUP BY source_id, attribute ORDER BY n DESC`)) {
    out(`- \`${a.attribute}\` (${a.source_id}): ${a.n} filas · ${a.c} países · ${a.v} valores distintos`)
  }
  out()

  out(`## Cobertura por país (pistas por fuente)`)
  const srcIds = q("SELECT id FROM sources WHERE id <> 'countries' ORDER BY id").map((s) => s.id)
  out(`| País | Total | ${srcIds.join(' | ')} |`)
  out(`|---|---:|${srcIds.map(() => '---:').join('|')}|`)
  const matrix = q(`SELECT c.code, c.name, h.source_id, COUNT(*) n FROM hints h
      JOIN countries c ON c.code = h.country_code GROUP BY c.code, h.source_id`)
  const byCountry = new Map()
  for (const r of matrix) {
    if (!byCountry.has(r.code)) byCountry.set(r.code, { name: r.name, total: 0, src: {} })
    const e = byCountry.get(r.code)
    e.src[r.source_id] = r.n
    e.total += r.n
  }
  for (const [code, e] of [...byCountry].sort((a, b) => b[1].total - a[1].total)) {
    out(`| ${e.name} (${code}) | ${e.total} | ${srcIds.map((s) => e.src[s] ?? '·').join(' | ')} |`)
  }
  out()

  const orphans = q(`SELECT country_raw, source_id, COUNT(*) n FROM hints
      WHERE country_code IS NULL AND country_raw IS NOT NULL GROUP BY country_raw, source_id ORDER BY n DESC LIMIT 40`)
  if (orphans.length) {
    out(`## Pistas con país sin resolver`)
    for (const o of orphans) out(`- "${o.country_raw}" (${o.source_id}): ${o.n}`)
    out()
  }

  const text = lines.join('\n')
  writeFileSync(path.join(DATA_DIR, 'REPORT.md'), text)
  // por consola, solo la cabecera y las tablas de fuente y categoría
  console.log('\n' + text.split('## Atributos')[0])
  console.log(`(informe completo en data/REPORT.md)`)
}
