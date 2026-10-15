import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type QuizPhoto, type QuizText, countryFlag, countryLabel, useCountryMap, useMeta } from '../lib/data'
import { useGeo } from '../lib/geo'
import { guides, type QuizRequest } from '../lib/guides'
import { useLang } from '../lib/i18n'
import { REGION_ES } from '../lib/labels'
import { LANDMARKS, type Landmark } from '../data/landmarks'
import { reviewCard, savedItems, useStudy } from '../lib/study/store'
import { isDue, isNew } from '../lib/study/fsrs'
import { maskText, pickDistractors, shuffle } from '../lib/study/quiz'
import type { Grade } from '../lib/study/types'
import { SaveButton } from '../components/study/SaveButton'
import { Loading, Usefulness } from '../components/ui'
import WikiImage from '../components/WikiImage'
import { imageSrc } from '../lib/images'

const StudyHub = lazy(() => import('../components/study/StudyHub'))

// Entrenar tiene dos partes:
//   · Mi estudio: lo que has guardado con ☆, en tus mazos (components/study/StudyHub.tsx)
//   · Práctica libre: "¿de qué país es esto?" con preguntas de todas las guías, con
//     distractores que se le parecen de verdad (los países con los que se confunde y, en
//     fotos, solo países que tienen ese mismo objeto). Las elige la API (/api/gg/quiz) con
//     tu progreso: solo viajan las de la sesión, no el banco entero.
// Las dos repasan con FSRS (lib/study/fsrs.ts) y comparten el progreso.

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
const GRADES: { g: Grade; label: string }[] = [
  { g: 2, label: 'Me costó' },
  { g: 3, label: 'Bien' },
  { g: 4, label: 'Fácil' },
]

export default function Train() {
  const [params, setParams] = useSearchParams()
  const s = useStudy()
  // con algo guardado se abre Mi estudio; ?pais= (desde una guía) y ?modo=libre, la práctica libre
  const free = params.get('modo') === 'libre' || params.has('pais') || (s.ready && savedItems(s).length === 0 && !params.has('mazo'))
  const go = (libre: boolean) => setParams(libre ? { modo: 'libre' } : {}, { replace: true })
  return (
    <div>
      <div className="train-tabs seg" role="tablist" aria-label="Entrenar">
        <button role="tab" aria-selected={!free} className={!free ? 'on' : ''} onClick={() => go(false)}>Mi estudio</button>
        <button role="tab" aria-selected={free} className={free ? 'on' : ''} onClick={() => go(true)}>Práctica libre</button>
      </div>
      {free ? (
        <Practice />
      ) : (
        <Suspense fallback={<div className="empty">Cargando tu estudio…</div>}>
          <StudyHub initialDeck={params.get('mazo') ?? undefined} />
        </Suspense>
      )}
    </div>
  )
}

function Practice() {
  const [params] = useSearchParams()
  const meta = useMeta()
  const map = useCountryMap()
  const study = useStudy()
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
  const quizCats = useGeo('gg-quiz-categories', guides.quizCategories)

  const inScope = (cc: string) => (!scope ? true : scope.startsWith('c:') ? cc === scope.slice(2) : map.get(cc)?.region === scope)
  // lugares: banco local (pocos); pistas y fotos: en la API
  const places = useMemo(
    () => ((mode === 'mix' || mode === 'place') && !category && !essentialOnly ? LANDMARKS.filter((l) => inScope(l.country)) : [])
      .map((l): Item => ({ kind: 'place', key: `l:${l.id}`, country: l.country, data: l })),
    [mode, scope, essentialOnly, category, map], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // las tarjetas de la práctica libre son las de clave sin "#" (pistas t:, fotos p:, lugares l:)
  const keys = Object.keys(study.cards).filter((k) => !k.includes('#') && /^(t|p|l):/.test(k))
  const dueKeys = useMemo(
    () => new Set(keys.filter((k) => !isNew(study.cards[k].state) && isDue(study.cards[k].state))),
    [study.cards], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const request = (size: number): QuizRequest => ({
    mode: mode === 'place' ? 'mix' : mode, scope, essential: essentialOnly, category, size,
    due: [...dueKeys].filter((k) => !k.startsWith('l:')),
    seen: size ? keys.filter((k) => !k.startsWith('l:')) : [],
  })
  // recuentos para el botón (preguntas posibles y cuántas tocan repasar)
  const [counts, setCounts] = useState<{ pool: number; due: number } | null>(null)
  useEffect(() => {
    if (mode === 'place') return setCounts({ pool: 0, due: 0 })
    let alive = true
    setCounts(null)
    const t = window.setTimeout(() => {
      guides.quiz(request(0)).then((r) => alive && setCounts({ pool: r.pool, due: r.due }), () => alive && setCounts({ pool: 0, due: 0 }))
    }, 150)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [mode, scope, essentialOnly, category, dueKeys.size]) // eslint-disable-line react-hooks/exhaustive-deps
  const poolSize = (counts?.pool ?? 0) + places.length
  const dueInPool = (counts?.due ?? 0) + places.filter((i) => dueKeys.has(i.key)).length
  const [starting, setStarting] = useState(false)

  async function start() {
    setStarting(true)
    try {
      const remote = mode === 'place' ? null : await guides.quiz(request(size))
      const fromApi: (Item & { due?: boolean; pool?: string })[] = (remote?.items ?? []).map((r) =>
        r.kind === 'text'
          ? { kind: 'text', key: r.key, country: r.cc, data: r.data as unknown as QuizText, due: r.due, pool: r.pool }
          : { kind: 'photo', key: r.key, country: r.cc, data: r.data as unknown as QuizPhoto, due: r.due, pool: r.pool },
      )
      // repaso primero (de la API y de los lugares), luego lo nuevo; máximo 2 por país
      const localDue = shuffle(places.filter((i) => dueKeys.has(i.key)))
      const localFresh = shuffle(places.filter((i) => !study.cards[i.key]))
      const ordered = [...shuffle([...fromApi.filter((i) => i.due), ...localDue]), ...shuffle([...fromApi.filter((i) => !i.due), ...localFresh])]
      const chosen: (Item & { pool?: string })[] = []
      const perCountry = new Map<string, number>()
      for (const it of ordered) {
        if (chosen.length >= size) break
        const n = perCountry.get(it.country) ?? 0
        if (!scope.startsWith('c:') && n >= 2) continue
        perCountry.set(it.country, n + 1)
        chosen.push(it)
      }
      const textPool = new Set(remote?.pools.text ?? [...map.keys()])
      setSession(
        chosen.map((item) => {
          const others =
            item.kind === 'place'
              ? [...item.data.distractors]
              : pickDistractors(item.country, new Set(remote?.pools[item.pool ?? 'text'] ?? textPool), map)
          return { item, options: shuffle([item.country, ...others]) }
        }),
      )
      setIdx(0)
      setPicked(null)
      setResults([])
      started.current = Date.now()
    } finally {
      setStarting(false)
    }
  }

  function answer(code: string) {
    if (picked || !session) return
    const { item } = session[idx]
    const ok = code === item.country
    const ms = Date.now() - started.current
    setPicked(code)
    setResults((r) => [...r, { item, ok }])
    // fallo: "otra vez" al momento (y la confusión queda anotada); acierto: la nota la eliges tú
    if (!ok) reviewCard(item.key, 1, { cc: item.country, answer: code, ms })
  }

  function next(grade?: Grade) {
    if (!session) return
    const { item } = session[idx]
    if (grade !== undefined) reviewCard(item.key, grade, { cc: item.country, answer: item.country, ms: Date.now() - started.current })
    setIdx((i) => i + 1)
    setPicked(null)
    started.current = Date.now()
  }

  if (!map.size) return <Loading what="preguntas" />

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
              {item.kind === 'text' && (
                <SaveButton item={{ key: item.key, kind: 'hint', cc: item.country, data: { text: text, lang, cat: item.data.k, catName: catName(item.data.k), sub: item.data.sk, region: item.data.r, u: item.data.u, img: item.data.i } }} />
              )}
              {item.kind === 'photo' && (
                <SaveButton item={{ key: `f:${item.data.i}`, kind: 'photo', cc: item.country, data: { img: item.data.i, cat: item.data.k, catName: catName(item.data.k), sub: item.data.sk } }} />
              )}
              {correct ? (
                <div className="row">
                  <span className="muted small">¿Qué tal?</span>
                  {GRADES.map((g) => (
                    <button key={g.g} className={`btn ${g.g === 3 ? 'btn-primary' : ''}`} onClick={() => next(g.g)}>{g.label}</button>
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
  const categories = meta?.categories.filter((c) => (quizCats.data?.categories[c.id] ?? 0) > 0) ?? []
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
            <button className="btn btn-primary btn-lg" disabled={poolSize < 1 || starting} onClick={start}>
              {starting ? 'Preparando…' : dueInPool > 0 ? 'Repasar y aprender' : 'Empezar'}
            </button>
            <span className="muted small">
              {counts ? `${poolSize.toLocaleString('es')} preguntas posibles${dueInPool > 0 ? ` · ${dueInPool} toca repasar` : ''}` : 'Contando preguntas…'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
