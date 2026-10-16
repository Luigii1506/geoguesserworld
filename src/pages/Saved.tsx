import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { countryFlag, countryLabel, useCountryMap } from '../lib/data'
import { kindLabel } from '../lib/geoFormat'
import { useDragToClose } from '../lib/gestures'
import { cardsOf, scopeCounts, SMART_DECKS } from '../lib/study/cards'
import { retrievability } from '../lib/study/fsrs'
import { createDeck, deleteDeck, liveDecks, renameDeck, savedItems, setItemDecks, setNote, unsaveItem, useStudy } from '../lib/study/store'
import type { HintData, PhotoData, PlaceData, StudyItem, TwinsData } from '../lib/study/types'
import { Img } from '../components/Img'
import { HintText, Lightbox, PlaceMap, StreetViewEmbed } from '../components/ui'

// Guardados: todo lo que marcaste con ☆ (pistas, fotos, lugares, gemelos), para verlo y
// repasarlo. Se filtra por tipo, país y mazo, y se busca también en tus notas. Cada tarjeta
// abre su ficha: el texto entero, las fotos, tu nota, sus mazos y «Repasar solo esto».

type Kind = '' | StudyItem['kind']
const KINDS: { id: Kind; label: string }[] = [
  { id: '', label: 'Todo' }, { id: 'hint', label: 'Pistas' }, { id: 'photo', label: 'Fotos' }, { id: 'place', label: 'Lugares' }, { id: 'twins', label: 'Gemelos' },
]

function titleOf(i: StudyItem, map: ReturnType<typeof useCountryMap>): string {
  if (i.kind === 'twins') {
    const d = i.data as TwinsData
    return `${countryLabel(map, d.a)} o ${countryLabel(map, d.b)}`
  }
  if (i.kind === 'place') return (i.data as PlaceData).name
  if (i.kind === 'photo') return (i.data as PhotoData).text || (i.data as PhotoData).catName || 'Foto'
  return (i.data as HintData).text
}
const imageOf = (i: StudyItem) =>
  i.kind === 'photo' ? (i.data as PhotoData).img : i.kind === 'place' ? (i.data as PlaceData).thumb : i.kind === 'hint' ? (i.data as HintData).img : undefined
const typeLabel = (i: StudyItem) =>
  i.kind === 'hint' ? (i.data as HintData).catName ?? 'Pista' : i.kind === 'photo' ? (i.data as PhotoData).catName ?? 'Foto' : i.kind === 'twins' ? 'Gemelos' : (i.data as PlaceData).kindLabel ?? kindLabel((i.data as PlaceData).kind)
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

export default function Saved() {
  const s = useStudy()
  const map = useCountryMap()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const kind = (params.get('tipo') ?? '') as Kind
  const cc = params.get('pais') ?? ''
  const deck = params.get('mazo') ?? ''
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const all = savedItems(s)
  const decks = liveDecks(s)
  const matchQ = (i: StudyItem) => !q || fold(`${titleOf(i, map)} ${i.note} ${typeLabel(i)} ${i.cc ? countryLabel(map, i.cc) : ''}`).includes(fold(q))
  const list = all
    .filter((i) => (!kind || i.kind === kind) && (!cc || i.cc === cc || (i.kind === 'twins' && [(i.data as TwinsData).a, (i.data as TwinsData).b].includes(cc))))
    .filter((i) => !deck || (deck === '_' ? i.decks.length === 0 : i.decks.includes(deck)))
    .filter(matchQ)
    .sort((a, b) => b.created_at - a.created_at)
  const kindCount = (k: Kind) => all.filter((i) => !k || i.kind === k).length
  const countries = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of all) if (i.cc) m.set(i.cc, (m.get(i.cc) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [all.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const pending = scopeCounts(s, deck && deck !== '_' ? { deck } : cc ? { cc } : {})
  const review = () => {
    const p = new URLSearchParams({ empezar: '1' })
    if (deck && deck !== '_') p.set('mazo', deck)
    else if (cc) p.set('estudiar', cc)
    navigate(`/entrenar?${p}`)
  }
  const openItem = open ? s.items[open] : undefined

  if (!s.ready) return <div className="empty">Cargando tus guardados…</div>
  if (!all.length) return <Empty />

  const currentDeck = deck && deck !== '_' ? s.decks[deck] : undefined
  return (
    <div className="saved">
      <header className="page-head saved-head">
        <div>
          <h1>Guardados</h1>
          <p className="lead">{all.length} {all.length === 1 ? 'cosa guardada' : 'cosas guardadas'} con ☆ para repasarlas.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={review}>
          {pending.due + pending.newAvailable > 0 ? `Repasar ${pending.due + pending.newAvailable}` : 'Repasar'}
          {currentDeck ? ` · ${currentDeck.name}` : cc ? ` · ${countryLabel(map, cc)}` : ''}
        </button>
      </header>

      <div className="toolbar saved-toolbar">
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus guardados y notas" aria-label="Buscar en tus guardados" />
        <div className="seg">
          {KINDS.filter((k) => !k.id || kindCount(k.id)).map((k) => (
            <button key={k.id || 'all'} className={kind === k.id ? 'on' : ''} onClick={() => set('tipo', k.id)}>
              {k.label} <span className="muted">{kindCount(k.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {(decks.length > 0 || countries.length > 1) && (
        <div className="saved-filters">
          {decks.length > 0 && (
            <div className="chips">
              <span className="eyebrow">Mazos</span>
              <button className={`chip ${!deck ? 'on' : ''}`} onClick={() => set('mazo', '')}>Todos</button>
              {decks.map((d) => (
                <button key={d.id} className={`chip ${deck === d.id ? 'on' : ''}`} onClick={() => set('mazo', deck === d.id ? '' : d.id)}>
                  {d.name} <span className="muted">{all.filter((i) => i.decks.includes(d.id)).length}</span>
                </button>
              ))}
              {all.some((i) => !i.decks.length) && <button className={`chip ${deck === '_' ? 'on' : ''}`} onClick={() => set('mazo', deck === '_' ? '' : '_')}>Sin mazo</button>}
            </div>
          )}
          {countries.length > 1 && (
            <div className="chips">
              <span className="eyebrow">País</span>
              {countries.map(([c, n]) => (
                <button key={c} className={`chip ${cc === c ? 'on' : ''}`} onClick={() => set('pais', cc === c ? '' : c)}>
                  {countryFlag(map, c)} {countryLabel(map, c)} <span className="muted">{n}</span>
                </button>
              ))}
            </div>
          )}
          {currentDeck && <DeckActions id={currentDeck.id} name={currentDeck.name} onDeleted={() => set('mazo', '')} />}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">Nada coincide. <button className="link" onClick={() => (setQ(''), setParams({}, { replace: true }))}>Quitar los filtros</button></div>
      ) : (
        <div className="saved-grid">
          {list.map((i) => {
            const img = imageOf(i)
            const r = Math.max(0, ...cardsOf(i).map((c) => retrievability(s.cards[c.key]?.state)))
            return (
              <button key={i.key} className={`saved-card ${img ? '' : 'noimg'}`} onClick={() => setOpen(i.key)}>
                {img ? (
                  <span className="saved-card-img"><Img src={img} sizes="(max-width: 600px) 46vw, 240px" /></span>
                ) : i.kind === 'twins' ? (
                  <span className="saved-card-img saved-card-art">{countryFlag(map, (i.data as TwinsData).a)} <em>vs</em> {countryFlag(map, (i.data as TwinsData).b)}</span>
                ) : null}
                <span className="saved-card-body">
                  <span className="saved-card-meta">
                    {i.cc && <span>{countryFlag(map, i.cc)} {countryLabel(map, i.cc)}</span>}
                    <span className="muted">{typeLabel(i)}</span>
                  </span>
                  <span className="saved-card-text">{titleOf(i, map)}</span>
                  {i.note && <span className="saved-card-note">“{i.note}”</span>}
                  {r > 0 && <span className={`hint-known ${r >= 0.85 ? 'good' : r >= 0.6 ? 'mid' : 'low'}`}>la recuerdas al {Math.round(r * 100)} %</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <p className="muted small saved-tip">
        Automáticos: {SMART_DECKS.map((d) => d.name).join(', ')}, en <Link to="/entrenar">Entrenar</Link>. Guarda más con ☆ en las guías, Explorar, el Catálogo o Geografía.
      </p>

      {openItem && <ItemSheet item={openItem} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Empty() {
  return (
    <div className="saved">
      <header className="page-head"><h1>Guardados</h1></header>
      <div className="study-empty">
        <h2>Aún no has guardado nada</h2>
        <p>Toca <strong>☆ Guardar</strong> en lo que quieras aprender: una pista de la guía de un país, una foto de Explorar, una ficha del Catálogo o un lugar de Geografía. También puedes guardar de golpe <strong>lo esencial de un país</strong> desde su guía.</p>
        <p>Aquí lo tendrás todo a mano, y en <strong>Entrenar → Repasar lo guardado</strong> lo repasarás justo antes de que se te olvide.</p>
        <div className="row">
          <Link to="/paises" className="btn btn-primary">Ir a un país</Link>
          <Link to="/catalogo" className="btn">Catálogo</Link>
          <Link to="/explorar" className="btn btn-quiet">Fotos</Link>
        </div>
      </div>
    </div>
  )
}

function DeckActions({ id, name, onDeleted }: { id: string; name: string; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])
  return (
    <div className="row deck-actions-bar">
      {editing ? (
        <form className="row" onSubmit={(e) => (e.preventDefault(), renameDeck(id, draft), setEditing(false))}>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <button className="btn btn-sm">Guardar</button>
        </form>
      ) : (
        <button className="btn btn-quiet btn-sm" onClick={() => setEditing(true)}>Renombrar «{name}»</button>
      )}
      <button className="btn btn-quiet btn-sm" onClick={() => confirm(`¿Borrar el mazo «${name}»? Lo guardado se queda.`) && (deleteDeck(id), onDeleted())}>Borrar mazo</button>
    </div>
  )
}

/** La ficha de un guardado: todo su contenido, tu nota, sus mazos y qué hacer con él. */
function ItemSheet({ item, onClose }: { item: StudyItem; onClose: () => void }) {
  const s = useStudy()
  const map = useCountryMap()
  const navigate = useNavigate()
  const drag = useDragToClose(onClose)
  const [note, setNoteDraft] = useState(item.note)
  const [box, setBox] = useState(false)
  const [place, setPlace] = useState(false)
  const [newDeck, setNewDeck] = useState('')
  const decks = liveDecks(s)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const img = imageOf(item)
  const d = item.data as HintData & PhotoData & PlaceData & TwinsData
  const saveNote = () => note !== item.note && setNote(item.key, note)
  const toggleDeck = (id: string) => setItemDecks(item.key, item.decks.includes(id) ? item.decks.filter((x) => x !== id) : [...item.decks, id])
  const guide = item.kind === 'twins' ? `/duelo?a=${d.a}&b=${d.b}` : item.kind === 'place' ? null : item.cc ? `/pais/${item.cc}` : null

  if (place && item.kind === 'place') {
    return <PlaceMap places={[{ id: d.id, n: d.name, es: d.name, lat: d.lat, lng: d.lng, k: d.kind, cc: item.cc ?? undefined }]} index={0} onClose={() => setPlace(false)} />
  }
  return createPortal(
    <>
    <div className="pm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pm-box saved-sheet" onClick={(e) => e.stopPropagation()} style={drag.style}>
        <div className="pm-head" {...drag.handle}>
          <div>
            <span className="eyebrow">{typeLabel(item)}</span>
            <strong>{item.kind === 'place' ? d.name : item.kind === 'twins' ? `${countryLabel(map, d.a)} o ${countryLabel(map, d.b)}` : item.cc ? `${countryFlag(map, item.cc)} ${countryLabel(map, item.cc)}` : 'Guardado'}</strong>
            {item.kind === 'place' && item.cc && <span className="pm-desc">{countryFlag(map, item.cc)} {countryLabel(map, item.cc)}</span>}
          </div>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="pm-body saved-sheet-body">
          {img && (
            <button className="shot saved-sheet-img" onClick={() => setBox(true)} aria-label="Ampliar">
              <Img src={img} size="img" sizes="(max-width: 700px) 92vw, 640px" loading="eager" />
            </button>
          )}
          {item.kind === 'hint' && d.text && <HintText text={d.text} />}
          {item.kind === 'photo' && d.text && <p className="muted">{d.text}</p>}
          {item.kind === 'place' && d.descr && <p className="muted">{d.descr}</p>}
          {item.kind === 'twins' && d.headline && <p className="saved-sheet-key">{d.headline}</p>}
          {item.kind === 'hint' && d.sv && <StreetViewEmbed sv={d.sv} />}

          <label className="save-note">
            <span className="eyebrow">Tu nota</span>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNoteDraft(e.target.value)} onBlur={saveNote} placeholder="Lo que quieres recordar de esto" />
          </label>

          <div className="save-decks">
            <span className="eyebrow">Mazos</span>
            <div className="chips">
              {decks.map((x) => (
                <button key={x.id} className={`chip ${item.decks.includes(x.id) ? 'on' : ''}`} onClick={() => toggleDeck(x.id)}>{x.name}</button>
              ))}
              <form className="save-newdeck" onSubmit={(e) => (e.preventDefault(), newDeck.trim() && (setItemDecks(item.key, [...item.decks, createDeck(newDeck)]), setNewDeck('')))}>
                <input className="input" value={newDeck} onChange={(e) => setNewDeck(e.target.value)} placeholder="Nuevo mazo" />
              </form>
            </div>
          </div>

          <div className="row saved-sheet-actions">
            <button className="btn btn-primary" onClick={() => (saveNote(), navigate(`/entrenar?item=${encodeURIComponent(item.key)}&empezar=1`))}>Repasar solo esto</button>
            {item.kind === 'place' && <button className="btn" onClick={() => setPlace(true)}>Ver el lugar</button>}
            {guide && <Link to={guide} className="btn" onClick={onClose}>{item.kind === 'twins' ? 'Ver el duelo' : 'Ver la guía'}</Link>}
            <button className="link danger" onClick={() => (unsaveItem(item.key), onClose())}>Quitar de Guardados</button>
          </div>
        </div>
      </div>
    </div>
    {/* fuera de la ficha: los toques del visor no deben llegar a su fondo (que la cierra) */}
    {box && img && <Lightbox images={[img]} index={0} onClose={() => setBox(false)} />}
    </>,
    document.body,
  )
}
