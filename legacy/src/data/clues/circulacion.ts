import type { Clue } from '../types'

const V = '2026-10-11'
const GH_DRIVING = { name: 'GeoHints · Driving Side', url: 'https://geohints.com/meta/drivingSide' }

export const CLUES_CIRCULACION: Clue[] = [
  {
    id: 'izquierda-mundo',
    name: 'Quién conduce por la izquierda',
    category: 'circulacion',
    countries: ['gb', 'ie', 'mt', 'cy', 'jp', 'th', 'my', 'sg', 'id', 'in', 'lk', 'bd', 'bt', 'np', 'hk', 'au', 'nz', 'za', 'ls', 'sz', 'bw', 'ke', 'ug'],
    visual:
      'El tráfico circula por el carril izquierdo; el volante va a la derecha.',
    lookFor:
      'Memoriza los bloques: Islas Británicas + Malta/Chipre; Japón; Sur y Sudeste de Asia (menos Vietnam/Camboya/Laos/Filipinas); África austral y oriental; Oceanía.',
    why: 'Herencia británica y japonesa en la mayoría de los casos.',
    howToUse:
      'Divide el mundo en dos antes de cualquier otra pista. En Europa, izquierda = UK/Irlanda/Malta/Chipre. En África, izquierda = sur y este (Kenia, Uganda, Sudáfrica...), derecha = oeste (Ghana, Nigeria, Senegal).',
    confidence: 'fuerte',
    related: ['detectar-sentido', 'vecinos-sentido-opuesto'],
    sources: [GH_DRIVING, { name: 'Geometas · Driving Direction', url: 'https://geometas.com/learn/driving_direction/' }],
    verifiedAt: V,
  },
  {
    id: 'detectar-sentido',
    name: 'Cómo detectar el sentido sin tráfico',
    category: 'circulacion',
    countries: [],
    visual: 'Carretera vacía: el sentido hay que deducirlo.',
    lookFor:
      '(1) Lado en que apuntan las señales legibles (las ves de frente en tu carril), (2) coches aparcados orientados con el morro en tu sentido, (3) posición de la línea central respecto al coche de Google, (4) flechas pintadas en el carril, (5) lado de las paradas de bus.',
    howToUse:
      'Comprueba dos indicios independientes antes de concluir: un coche mal aparcado o una señal trasera te puede engañar.',
    confidence: 'fuerte',
    related: ['izquierda-mundo'],
    sources: [GH_DRIVING],
    verifiedAt: V,
  },
  {
    id: 'vecinos-sentido-opuesto',
    name: 'Fronteras donde cambia el sentido',
    category: 'circulacion',
    countries: ['th', 'kh', 'la', 'vn', 'ph', 'id', 'gh', 'ke'],
    visual: 'Países vecinos y parecidos que conducen por lados opuestos.',
    lookFor:
      'Tailandia (izq) vs Camboya/Laos/Vietnam (dcha). Indonesia/Malasia (izq) vs Filipinas (dcha). Kenia/Uganda (izq) vs Ghana/Nigeria (dcha). Hong Kong (izq) vs China continental (dcha).',
    howToUse:
      'Cuando dudes entre dos vecinos del Sudeste Asiático o de África, el sentido de circulación suele zanjar la duda en segundos.',
    confidence: 'fuerte',
    related: ['izquierda-mundo', 'tailandes-lao-jemer-birmano'],
    sources: [GH_DRIVING],
    verifiedAt: V,
  },
]
