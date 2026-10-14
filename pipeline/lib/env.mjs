// Variables de .env (sin dependencias). process.env tiene prioridad.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from './paths.mjs'

let cache = null

export function env(name) {
  if (process.env[name]) return process.env[name]
  if (!cache) {
    cache = {}
    const file = path.join(ROOT, '.env')
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
        if (m) cache[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  }
  return cache[name] || undefined
}
