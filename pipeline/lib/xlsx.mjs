// Lectura mínima de un .xlsx ya descomprimido (unzip): el texto de cada celda y, si tiene,
// su enlace (hipervínculo de la celda o fórmula HYPERLINK). Sin dependencias.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&amp;/g, '&')

/** Las hojas del libro: [{ name, rows: [[nº de fila, { A: 'texto' | { text, link } }]] }] */
export function readWorkbook(dir) {
  const read = (f) => readFileSync(path.join(dir, f), 'utf8')
  const shared = existsSync(path.join(dir, 'xl/sharedStrings.xml'))
    ? [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
    : []
  const bookRels = Object.fromEntries([...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship ([^>]*)\/?>/g)].map((m) => [attr(m[1], 'Id'), attr(m[1], 'Target')]))
  return [...read('xl/workbook.xml').matchAll(/<sheet ([^>]*)\/?>/g)].map((m) => {
    const file = path.posix.join('xl', bookRels[attr(m[1], 'r:id')].replace(/^\/?xl\//, ''))
    return { name: decode(attr(m[1], 'name')), rows: readSheet(dir, file, shared) }
  })
}

const attr = (s, name) => s.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''

function readSheet(dir, file, shared) {
  const xml = readFileSync(path.join(dir, file), 'utf8')
  const relsFile = path.join(dir, path.dirname(file), '_rels', `${path.basename(file)}.rels`)
  const rels = existsSync(relsFile)
    ? Object.fromEntries([...readFileSync(relsFile, 'utf8').matchAll(/<Relationship ([^>]*)\/?>/g)].map((m) => [attr(m[1], 'Id'), decode(attr(m[1], 'Target'))]))
    : {}
  const links = Object.fromEntries([...xml.matchAll(/<hyperlink ([^>]*)\/?>/g)].map((m) => [attr(m[1], 'ref'), rels[attr(m[1], 'r:id')]]))
  const rows = []
  for (const r of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {}
    for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, attrs, inner = ''] = c
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      const f = inner.match(/<f>([\s\S]*?)<\/f>/)?.[1]
      const text = v == null ? decode(inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '') : /t="s"/.test(attrs) ? shared[+v] : decode(v)
      const link = links[col + r[1]] ?? (f ? decode(f).match(/HYPERLINK\("([^"]+)"/i)?.[1] : undefined)
      if (text || link) cells[col] = link ? { text, link } : text
    }
    if (Object.keys(cells).length) rows.push([+r[1], cells])
  }
  return rows
}
