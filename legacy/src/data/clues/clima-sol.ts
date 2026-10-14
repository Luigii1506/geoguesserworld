import type { Clue } from '../types'

const V = '2026-10-11'
const PLONKIT = { name: 'Plonk It · Guía de principiantes', url: 'https://www.plonkit.net/beginners-guide' }

export const CLUES_CLIMA: Clue[] = [
  {
    id: 'sol-hemisferio',
    name: 'El sol delata el hemisferio',
    category: 'clima-sol',
    countries: [],
    visual: 'Posición del sol y dirección de las sombras respecto a la brújula del juego.',
    lookFor:
      'Fuera de los trópicos: sol hacia el SUR (sombras al norte) → hemisferio norte; sol hacia el NORTE → hemisferio sur. Usa la brújula en pantalla para orientarte.',
    why: 'La trayectoria solar se inclina hacia el ecuador visto desde cada hemisferio.',
    howToUse:
      'Primera comprobación en paisajes ambiguos (pampa vs pradera, bush vs matorral ibérico). Cerca del ecuador o a mediodía alto, no es concluyente.',
    confidence: 'fuerte',
    exceptions: ['Entre trópicos el sol puede estar a ambos lados según la estación: no apuestes ahí.'],
    related: ['pampa-uy-ar', 'eucaliptos-australia'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'nieve-y-estacion',
    name: 'Nieve, estación y fecha de cobertura',
    category: 'clima-sol',
    countries: [],
    visual: 'Nieve en el suelo, árboles pelados o vegetación quemada por el verano.',
    lookFor:
      'Nieve + conducción derecha + abedules → piensa Rusia/Nórdicos/Canadá. Hierba agostada en julio → Mediterráneo o interior australiano según hemisferio.',
    howToUse:
      'La estación aparente combinada con el hemisferio (sol) acota latitud. Recuerda: la imagen puede tener años; la estación es de la FECHA DE CAPTURA.',
    confidence: 'contextual',
    related: ['sol-hemisferio', 'taiga-abedules'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'luz-tropical',
    name: 'Luz y bruma tropical',
    category: 'clima-sol',
    countries: [],
    visual: 'Cielo blanquecino brumoso, sombras cortas, vegetación exuberante todo el año.',
    lookFor: 'Sombras casi verticales a mediodía = cerca del ecuador.',
    howToUse:
      'Bruma + sombra vertical + vegetación perenne → franja ecuatorial: Sudeste Asiático, África central-occidental o norte de Sudamérica. Decide por idioma y circulación.',
    confidence: 'contextual',
    related: ['tierra-roja-tropical', 'arrozales-sudeste'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
]
