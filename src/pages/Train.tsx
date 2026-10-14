import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type CountryRow, type QuizPhoto, type QuizText, countryFlag, countryLabel, useCountryMap, useMeta, useQuiz } from '../lib/data'
import { useLang } from '../lib/i18n'
import { REGION_ES } from '../lib/labels'
import { LANDMARKS, type Landmark } from '../data/landmarks'
import { updateProgress, useProgress } from '../lib/storage'
import { isDue, newSm2State, review } from '../lib/sm2'
import { Loading, MissingData, Usefulness } from '../components/ui'
import WikiImage from '../components/WikiImage'
import { imageSrc } from '../lib/images'

// Entrenamiento con repetición espaciada (SM-2). Cada pregunta es "¿de qué
// país es esto?" con distractores que se le parecen de verdad: los países con
// los que se confunde, y en fotos, solo países que tienen ese mismo objeto.

type Mode = 'mix' | 'text' | 'photo' | 'place'
type Item =
  | { kind: 'text'; key: string; country: string; data: QuizText }
  | { kind: 'photo'; key: string; country: string; data: QuizPhoto }
  | { kind: 'place'; key: string; country: string; data: Landmark }

interface Question {
  item: Item
  options: string[]
}

const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
const MODES: [Mode, string][] = [['mix', 'Todo'], ['text', 'Pistas'], ['photo', 'Fotos'], ['place', 'Lugares']]
const shuffle = <T,>(a: T[]) => {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/**
 * Oculta nombre, capital y gentilicios del país para no regalar la respuesta.
 * Los términos de 4+ letras también tapan las palabras que empiezan por ellos:
 * así "Slovenia" cubre "Slovenian" e "Iceland" cubre "Icelandic", variantes
 * que los datasets de gentilicios no traen.
 */
function maskText(text: string, terms: string[]) {
  let out = text
  for (const t of [...terms].sort((a, b) => b.length - a.length)) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tail = t.length >= 4 ? '\\p{L}*' : ''
    out = out.replace(new RegExp(`(?<![\\p{L}])${esc}${tail}(?![\\p{L}])`, 'giu'), '▢▢▢')
  }
  return out
}

// Para que una opción sea plausible el país debe tener datos suficientes:
// así no aparecen territorios diminutos como distractor.
const MIN_GROUPS = 25

/**
 * Distractores en orden de parecido: los 2 más confundibles (de los 3 más
 * fuertes, la lista viene ordenada por peso), después la misma subregión,
 * la misma región y, en último caso, cualquiera.
 */
function pickDistractors(correct: string, pool: Set<string>, map: Map<string, CountryRow>): string[] {
  const c = map.get(correct)
  const ok = (x: string) => pool.has(x) && (map.get(x)?.groups ?? 0) >= MIN_GROUPS
  const chosen: string[] = []
  const add = (code: string) => {
    if (code !== correct && ok(code) && !chosen.includes(code) && chosen.length < 3) chosen.push(code)
  }
  const strong = (c?.confusable ?? []).filter(ok)
  shuffle(strong.slice(0, 3)).slice(0, 2).forEach(add)
  shuffle([...pool].filter((x) => map.get(x)?.subregion === c?.subregion)).forEach(add)
  strong.slice(3).forEach(add)
  shuffle([...pool].filter((x) => map.get(x)?.region === c?.region)).forEach(add)
  shuffle([...pool]).forEach(add)
  return chosen
}

const GRADES = [
  { q: 3, label: 'Me costó' },
  { q: 4, label: 'Bien' },
  { q: 5, label: 'Fácil' },
]

export default function Train() {
  const [params] = useSearchParams()
  const quiz = useQuiz()
  const meta = useMeta()
  const map = useCountryMap()
  const progress = useProgress()
  const lang = useLang()

  const [mode, setMode] = useState<Mode>('mix')
  const [scope, setScope] = useState<string>(params.get('pais') ? `c:${params.get('pais')}` : '')
  const [essentialOnly, setEssentialOnly] = useState(false)
  const [category, setCategory] = useState('')
  const [size, setSize] = useState(10)

  const [session, setSession] = useState<Question[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [results, setResults] = useState<{ item: Item; ok: boolean }[]>([])
  const started = useRef(Date.now())

  const catName = (id: string) => meta?.categories.find((c) => c.id === id)?.name ?? id

  const pool = useMemo(() => {
    if (!quiz) return [] as Item[]
    const inScope = (cc: string) => (!scope ? true : scope.startsWith('c:') ? cc === scope.slice(2) : map.get(cc)?.region === scope)
    const items: Item[] = []
    if (mode === 'mix' || mode === 'text')
      for (const t of quiz.texts)
        if (inScope(t.c) && (!essentialOnly || t.u === 3) && (!category || t.k === category))
          items.push({ kind: 'text', key: `t:${t.id}`, country: t.c, data: t })
    if (mode === 'mix' || mode === 'photo')
      for (const p of quiz.photos)
        if (inScope(p.c) && (!category || p.k === category)) items.push({ kind: 'photo', key: `p:${p.id}:${p.i}`, country: p.c, data: p })
    if ((mode === 'mix' || mode === 'place') && !category && !essentialOnly)
      for (const l of LANDMARKS) if (inScope(l.country)) items.push({ kind: 'place', key: `l:${l.id}`, country: l.country, data: l })
    return items
  }, [quiz, mode, scope, essentialOnly, category, map])

  const dueKeys = useMemo(
    () => new Set(Object.entries(progress.srs).filter(([k, s]) => k.includes(':') && isDue(s)).map(([k]) => k)),
    [progress.srs],
  )
  const dueInPool = pool.filter((i) => dueKeys.has(i.key)).length

  const countriesWith = useMemo(() => {
    const text = new Set<string>()
    const photo = new Map<string, Set<string>>()
    for (const t of quiz?.texts ?? []) text.add(t.c)
    for (const p of quiz?.photos ?? []) {
      const k = `${p.k}|${p.sk ?? ''}`
      if (!photo.has(k)) photo.set(k, new Set())
      photo.get(k)!.add(p.c)
    }
    return { text, photo }
  }, [quiz])

  function start() {
    const due = shuffle(pool.filter((i) => dueKeys.has(i.key)))
    const fresh = shuffle(pool.filter((i) => !progress.srs[i.key])).sort(
      (a, b) => (b.kind === 'text' ? b.data.u : 2) - (a.kind === 'text' ? a.data.u : 2),
    )
    const chosen: Item[] = []
    const perCountry = new Map<string, number>()
    for (const it of [...due, ...fresh]) {
      if (chosen.length >= size) break
      const n = perCountry.get(it.country) ?? 0
      if (!scope.startsWith('c:') && n >= 2) continue
      perCountry.set(it.country, n + 1)
      chosen.push(it)
    }
    setSession(
      chosen.map((item) => {
        const others =
          item.kind === 'place'
            ? [...item.data.distractors]
            : pickDistractors(
                item.country,
                item.kind === 'photo' ? countriesWith.photo.get(`${item.data.k}|${item.data.sk ?? ''}`) ?? countriesWith.text : countriesWith.text,
                map,
              )
        return { item, options: shuffle([item.country, ...others]) }
      }),
    )
    setIdx(0)
    setPicked(null)
    setResults([])
    started.current = Date.now()
  }

  function answer(code: string) {
    if (picked || !session) return
    const { item } = session[idx]
    const ok = code === item.country
    const ms = Date.now() - started.current
    setPicked(code)
    setResults((r) => [...r, { item, ok }])
    updateProgress((p) => ({
      ...p,
      log: [...p.log.slice(-1999), { date: new Date().toISOString(), questionId: item.key, correct: ok, ms, mode: 'practica' }],
      srs: ok ? p.srs : { ...p.srs, [item.key]: review(p.srs[item.key] ?? newSm2State(), 1, ms) },
    }))
  }

  function next(grade?: number) {
    if (!session) return
    const { item } = session[idx]
    if (grade !== undefined) {
      const ms = Date.now() - started.current
      updateProgress((p) => ({ ...p, srs: { ...p.srs, [item.key]: review(p.srs[item.key] ?? newSm2State(), grade, ms) } }))
    }
    setIdx((i) => i + 1)
    setPicked(null)
    started.current = Date.now()
  }

  if (quiz === undefined || !map.size) return <Loading what="preguntas" />
  if (quiz === null) return <MissingData />

  // ── resumen ──
  if (session && idx >= session.length) {
    const ok = results.filter((r) => r.ok).length
    const misses = [...new Set(results.filter((r) => !r.ok).map((r) => r.item.country))]
    return (
      <div className="page-narrow">
        <header className="page-head">
          <span className="eyebrow">Sesión terminada</span>
          <h1>{ok} de {results.length}</h1>
          <p className="lead">
            {ok === results.length
              ? 'Perfecto. Estas preguntas volverán dentro de unos días para fijarlas.'
              : 'Lo que fallaste vuelve mañana: así se aprende, repasando justo antes de olvidar.'}
          </p>
        </header>
        {misses.length > 0 && (
          <div className="filter-group" style={{ marginBottom: '1.6rem' }}>
            <span className="eyebrow">Repasa estos países</span>
            <div className="chips">
              {misses.map((c) => <Link key={c} to={`/pais/${c}`} className="chip">{countryFlag(map, c)} {countryLabel(map, c)}</Link>)}
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn btn-primary btn-lg" onClick={start}>Otra sesión</button>
          <button className="btn btn-lg" onClick={() => setSession(null)}>Cambiar ajustes</button>
        </div>
      </div>
    )
  }

  // ── pregunta ──
  if (session) {
    const { item, options } = session[idx]
    const country = map.get(item.country)
    const answered = picked !== null
    const correct = picked === item.country
    const text = item.kind === 'text' ? (lang === 'es' ? item.data.es : item.data.en) : ''
    return (
      <div className="page-narrow">
        <div className="row">
          <span className="muted small num">{idx + 1} / {session.length}</span>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn btn-quiet" onClick={() => setSession(null)}>Salir</button>
        </div>
        <div className="train-progress"><span style={{ width: `${(idx / session.length) * 100}%` }} /></div>

        <div className="question">
          {item.kind === 'text' && (
            <>
              <div className="row">
                <span className="eyebrow">{catName(item.data.k)}</span>
                <Usefulness value={item.data.u} />
              </div>
              <h2>¿De qué país es esta pista?</h2>
              <p className="question-text">{answered ? text : maskText(text, country?.mask ?? [])}</p>
              {item.data.i && answered && <img className="question-img" src={imageSrc(item.data.i)} alt="" />}
            </>
          )}
          {item.kind === 'photo' && (
            <>
              <span className="eyebrow">{catName(item.data.k)}{item.data.sk ? ` · ${item.data.sk.replace(/_/g, ' ')}` : ''}</span>
              <h2>¿De qué país es esta foto?</h2>
              <img className="question-img" src={imageSrc(item.data.i)} alt="" />
            </>
          )}
          {item.kind === 'place' && (
            <>
              <span className="eyebrow">Lugar</span>
              <h2>¿En qué país está?</h2>
              <WikiImage title={item.data.wikiTitle} eager showAttribution={answered} />
              {answered && <p className="question-text"><strong>{item.data.name}.</strong> {item.data.clue}</p>}
            </>
          )}

          <div className="answers">
            {options.map((code) => (
              <button
                key={code}
                className={`answer ${answered && code === item.country ? 'right' : ''} ${answered && code === picked && !correct ? 'wrong' : ''}`}
                disabled={answered}
                onClick={() => answer(code)}
              >
                <span className="flag">{countryFlag(map, code)}</span> {countryLabel(map, code)}
              </button>
            ))}
          </div>

          {answered && (
            <div className="feedback">
              <p>
                <strong>{correct ? 'Correcto.' : `Era ${countryLabel(map, item.country)}.`}</strong>{' '}
                {item.kind === 'text' && item.data.r && <>Región: {item.data.r}. </>}
                {item.kind === 'text' && item.data.n > 1 && <>Lo confirman {item.data.n} fuentes. </>}
                <Link to={`/pais/${item.country}`}>Guía de {countryLabel(map, item.country)}</Link>
              </p>
              {correct ? (
                <div className="row">
                  <span className="muted small">¿Qué tal?</span>
                  {GRADES.map((g) => (
                    <button key={g.q} className={`btn ${g.q === 4 ? 'btn-primary' : ''}`} onClick={() => next(g.q)}>{g.label}</button>
                  ))}
                </div>
              ) : (
                <div><button className="btn btn-primary" onClick={() => next()}>Siguiente</button></div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── ajustes ──
  const categories = meta?.categories.filter((c) => quiz.texts.some((t) => t.k === c.id)) ?? []
  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Entrenar</h1>
        <p className="lead">
          Preguntas sacadas de las pistas reales, con países que se confunden de verdad. Lo que fallas vuelve pronto; lo que
          dominas, cada vez más tarde.
        </p>
      </header>

      <div className="settings">
        <div className="setting">
          <span className="eyebrow">Qué practicar</span>
          <div className="seg">
            {MODES.map(([m, l]) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{l}</button>)}
          </div>
        </div>
        <div className="setting">
          <span className="eyebrow">Dónde</span>
          <div className="seg">
            <button className={!scope ? 'on' : ''} onClick={() => setScope('')}>Todo el mundo</button>
            {REGIONS.map((r) => <button key={r} className={scope === r ? 'on' : ''} onClick={() => setScope(r)}>{REGION_ES[r]}</button>)}
            {scope.startsWith('c:') && <button className="on">{countryLabel(map, scope.slice(2))}</button>}
          </div>
        </div>
        <div className="setting">
          <span className="eyebrow">Filtrar</span>
          <div className="row">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="select" value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[10, 20, 30].map((n) => <option key={n} value={n}>{n} preguntas</option>)}
            </select>
            <label className="check">
              <input type="checkbox" checked={essentialOnly} onChange={(e) => setEssentialOnly(e.target.checked)} /> Solo determinantes
            </label>
          </div>
        </div>
        <div className="feedback">
          <div className="row">
            <button className="btn btn-primary btn-lg" disabled={pool.length < 1} onClick={start}>
              {dueInPool > 0 ? 'Repasar y aprender' : 'Empezar'}
            </button>
            <span className="muted small">
              {pool.length.toLocaleString('es')} preguntas posibles{dueInPool > 0 ? ` · ${dueInPool} toca repasar` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
