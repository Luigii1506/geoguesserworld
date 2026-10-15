// Crea o actualiza las tablas de Neon:
//   · Better Auth (user, session, account, verification, rateLimit), con las mismas opciones que el Worker
//   · estudio de cada usuario (worker/src/db/study.sql, idempotente)
//
//   node worker/scripts/migrate.mjs           aplica lo que falte
//   node worker/scripts/migrate.mjs --dry     solo muestra el SQL
//
// Lee DATABASE_URL y BETTER_AUTH_SECRET de .env.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { neon } from '@neondatabase/serverless'
import { getMigrations } from 'better-auth/db/migration'
import { authOptions } from '../src/auth.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = Object.fromEntries(
  readFileSync(path.join(root, '.env'), 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]),
)
if (!env.DATABASE_URL) throw new Error('falta DATABASE_URL en .env (la cadena de conexión de Neon)')
if (!env.BETTER_AUTH_SECRET) throw new Error('falta BETTER_AUTH_SECRET en .env')

const { toBeCreated, toBeAdded, runMigrations, compileMigrations } = await getMigrations(authOptions(env))
console.log(`[auth] tablas nuevas: ${toBeCreated.map((t) => t.table).join(', ') || '—'} · columnas nuevas: ${toBeAdded.map((t) => t.table).join(', ') || '—'}`)
if (process.argv.includes('--dry')) console.log(await compileMigrations())
else if (toBeCreated.length || toBeAdded.length) {
  await runMigrations()
  console.log('[auth] ✓ tablas de Better Auth al día')
}

// estudio: CREATE … IF NOT EXISTS (se puede repetir)
const studySql = readFileSync(path.join(root, 'worker/src/db/study.sql'), 'utf8')
  .replace(/--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
if (process.argv.includes('--dry')) console.log(studySql.join(';\n\n'))
else {
  const sql = neon(env.DATABASE_URL)
  for (const statement of studySql) await sql.query(statement)
  console.log(`[study] ✓ ${studySql.length} sentencias aplicadas`)
}
