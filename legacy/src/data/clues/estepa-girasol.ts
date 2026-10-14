import type { Clue } from '../types'

const V = '2026-10-11'

// Fichas sueltas que completan enlaces referenciados desde otros archivos.

export const CLUES_EXTRA: Clue[] = [
  {
    id: 'estepa-girasol-ucrania',
    name: 'Ucrania: estepa negra y girasoles',
    category: 'paisaje',
    countries: ['ua'],
    visual:
      'Llanura agrícola enorme de suelo negro (chernozem), campos de girasol y trigo hasta el horizonte.',
    lookFor: 'El suelo casi negro en los bordes arados y las hileras de árboles cortavientos.',
    howToUse:
      'Estepa agrícola + cirílico con і/ї → Ucrania; el sur de Rusia es similar (el alfabeto decide).',
    confidence: 'contextual',
    related: ['cirilico-ruso-vs-ucraniano', 'taiga-abedules'],
    sources: [{ name: 'Plonk It · Ucrania', url: 'https://www.plonkit.net/ukraine' }],
    verifiedAt: V,
  },
  {
    id: 'olivos-mediterraneo',
    name: 'Olivares: el anillo mediterráneo',
    category: 'paisaje',
    countries: ['es', 'gr', 'it', 'pt', 'tn', 'tr', 'jo'],
    visual: 'Hileras de olivos de tronco retorcido y hoja gris-verde sobre tierra clara u ocre.',
    lookFor: 'El brillo plateado de la hoja al viento y el marco de plantación regular.',
    howToUse:
      'Acota el clima mediterráneo (Europa del sur, Magreb, Levante). El idioma del primer cartel decide el país.',
    confidence: 'contextual',
    related: ['teja-arabe-mediterraneo', 'hebreo-vs-arabe'],
    sources: [{ name: 'GeoHints · Nature', url: 'https://geohints.com/meta/nature' }],
    verifiedAt: V,
  },
]
