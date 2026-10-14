// Cliente mínimo de DeepSeek (API compatible con OpenAI) con caché en disco.
// Cada respuesta se guarda en data/llm-cache/ por hash de (modelo + mensajes):
// repetir una ejecución no vuelve a llamar a la API ni a cobrar.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, ROOT } from './paths.mjs'

const CACHE_DIR = path.join(DATA_DIR, 'llm-cache')
const BASE_URL = 'https://api.deepseek.com'

// Precio por millón de tokens en hora punta (api-docs.deepseek.com, 2026-10-13).
// Fuera de hora punta es la mitad; se usa el de punta para no subestimar.
export const PRICING = {
  'deepseek-flash': { inHit: 0.006, inMiss: 0.3, out: 1.2 },
  'deepseek-v4-pro': { inHit: 0.044, inMiss: 1.32, out: 3.96 },
}

function loadKey() {
  if (process.env.DEEPSEEK_API) return process.env.DEEPSEEK_API
  const envFile = path.join(ROOT, '.env')
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*DEEPSEEK_API\s*=\s*"?([^"\n]+)"?\s*$/)
      if (m) return m[1].trim()
    }
  }
  throw new Error('Falta DEEPSEEK_API en .env')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function createLlm({ model = 'deepseek-flash', concurrency = 6 } = {}) {
  const key = loadKey()
  mkdirSync(CACHE_DIR, { recursive: true })
  const usage = { calls: 0, cached: 0, promptHit: 0, promptMiss: 0, completion: 0, failed: 0 }

  let active = 0
  const queue = []
  const acquire = () =>
    new Promise((resolve) => {
      if (active < concurrency) {
        active++
        resolve()
      } else queue.push(resolve)
    })
  const release = () => {
    const next = queue.shift()
    if (next) next()
    else active--
  }

  /** Llama al modelo pidiendo JSON; devuelve el objeto parseado (o null). */
  // Sin modo "thinking": en esta tarea de clasificación el razonamiento gastaba
  // ~1.000 tokens por llamada y a veces agotaba max_tokens dejando la respuesta vacía.
  async function json(messages, { maxTokens = 1500, thinking = false } = {}) {
    const body = {
      model,
      messages,
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      thinking: { type: thinking ? 'enabled' : 'disabled' },
    }
    const hash = createHash('sha1').update(JSON.stringify({ model, messages, thinking })).digest('hex')
    const file = path.join(CACHE_DIR, `${hash}.json`)
    if (existsSync(file)) {
      usage.cached++
      return JSON.parse(readFileSync(file, 'utf8')).parsed
    }

    await acquire()
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        let res
        try {
          res = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
          })
        } catch {
          await sleep(3000 * (attempt + 1))
          continue
        }
        if (res.status === 429 || res.status >= 500) {
          await sleep(5000 * (attempt + 1))
          continue
        }
        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
        const data = await res.json()
        usage.calls++
        const u = data.usage ?? {}
        usage.promptHit += u.prompt_cache_hit_tokens ?? 0
        usage.promptMiss += u.prompt_cache_miss_tokens ?? u.prompt_tokens ?? 0
        usage.completion += u.completion_tokens ?? 0
        const content = data.choices?.[0]?.message?.content ?? ''
        let parsed = null
        try {
          parsed = JSON.parse(content)
        } catch {
          parsed = null
        }
        // solo se guarda en caché una respuesta válida: una vacía o rota se reintenta
        if (parsed === null) continue
        writeFileSync(file, JSON.stringify({ model, messages, thinking, content, parsed, usage: u }))
        return parsed
      }
      usage.failed++
      return null
    } finally {
      release()
    }
  }

  function cost() {
    const p = PRICING[model] ?? PRICING['deepseek-flash']
    return (usage.promptHit * p.inHit + usage.promptMiss * p.inMiss + usage.completion * p.out) / 1e6
  }

  return { json, usage, cost, model }
}
