import type { Clue } from '../types'

const V = '2026-10-11'
const PLONKIT = { name: 'Plonk It · Índice de guías', url: 'https://www.plonkit.net/guide' }

export const CLUES_CULTURA: Clue[] = [
  {
    id: 'casas-espiritus',
    name: 'Casas de espíritus: Tailandia',
    category: 'cultura',
    countries: ['th'],
    visual:
      'Pequeños templos en miniatura sobre un pedestal en jardines y frente a negocios, con ofrendas.',
    lookFor: 'La casita dorada/blanca sobre poste, a menudo con guirnaldas y botellas rojas de ofrenda.',
    why: 'Tradición animista tailandesa (san phra phum) integrada en el budismo local.',
    howToUse:
      'Casa de espíritus → Tailandia con altísima probabilidad (Laos y Camboya las tienen, pero mucho menos y distintas).',
    confidence: 'fuerte',
    related: ['tailandes-lao-jemer-birmano', 'postes-tropicos-hormigon'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'jeepneys-filipinas',
    name: 'Jeepneys y triciclos: Filipinas',
    category: 'cultura',
    countries: ['ph'],
    visual:
      'Minibuses alargados cromados y pintados con colores vivos (jeepneys) y motos con sidecar techado (tricycles).',
    lookFor: 'Cualquiera de los dos vehículos es exclusivo del paisaje filipino.',
    why: 'Los jeepneys descienden de los jeeps militares estadounidenses adaptados tras 1945.',
    howToUse: 'Jeepney o tricycle visto → Filipinas, sin más vueltas.',
    confidence: 'fuerte',
    related: ['vecinos-sentido-opuesto'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'rickshaws-por-pais',
    name: 'Rickshaws y mototaxis por país',
    category: 'cultura',
    countries: ['th', 'lk', 'in', 'bd', 'pe', 'ng'],
    visual: 'Vehículos ligeros de tres ruedas para pasajeros, distintos en cada región.',
    lookFor:
      'Tuk-tuk abierto → Tailandia. Three-wheeler cerrado (Bajaj) → Sri Lanka/India. Rickshaw de PEDAL decorado → Bangladés. Mototaxi carrozada → Perú. Keke amarillo → Nigeria.',
    howToUse:
      'El tipo de triciclo es a menudo más rápido que leer un cartel para fijar el país.',
    confidence: 'moderada',
    related: ['devanagari-vs-bengali', 'matricula-india-comercial'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'gauchito-gil',
    name: 'Santuarios rojos del Gauchito Gil',
    category: 'cultura',
    countries: ['ar'],
    visual:
      'Altares al borde de la ruta con banderas y telas ROJAS, botellas y exvotos.',
    lookFor: 'La mancha roja intensa en la banquina; a veces junto a ermitas blancas (Difunta Correa).',
    why: 'Devoción popular argentina a santos no canónicos, señalizada en rojo.',
    howToUse: 'Santuario rojo de carretera → Argentina casi seguro.',
    confidence: 'fuerte',
    related: ['pampa-uy-ar', 'matricula-mercosur'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'turquia-banderas',
    name: 'Turquía: banderas y Atatürk',
    category: 'cultura',
    countries: ['tr'],
    visual:
      'Banderas rojas con media luna en tamaños enormes, retratos y estatuas de Atatürk en cada plaza.',
    lookFor: 'La densidad de banderas es mayor que en casi cualquier otro país.',
    howToUse: 'Bandera turca omnipresente + ı/ğ/ş → Turquía.',
    confidence: 'fuerte',
    related: ['turco-letras', 'teja-arabe-mediterraneo'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'iglesias-ortodoxas',
    name: 'Cúpulas ortodoxas',
    category: 'cultura',
    countries: ['ru', 'ua', 'gr', 'rs', 'bg', 'ro'],
    visual: 'Iglesias con cúpulas de cebolla doradas o campanarios bizantinos.',
    lookFor:
      'Cebolla dorada → eslavo oriental. Cúpula baja con teja → Balcanes/Grecia. Madera con torres → Rumanía (Maramureș).',
    howToUse:
      'Marca el mundo ortodoxo; el alfabeto del cartel más cercano decide el país.',
    confidence: 'contextual',
    related: ['cirilico-ruso-vs-ucraniano', 'cirilico-bulgaro-serbio'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'mexico-topes',
    name: 'México: topes, vochos y muros pintados',
    category: 'cultura',
    countries: ['mx'],
    visual:
      'Badenes señalizados ("TOPE"), VW Beetle antiguos, publicidad pintada a mano en muros (Coca-Cola, partidos políticos).',
    lookFor: 'La palabra TOPE y los muros-anuncio de colores.',
    howToUse:
      'TOPE/vocho/muro pintado + ALTO → México, no Sudamérica.',
    confidence: 'fuerte',
    related: ['alto-vs-pare'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'carros-rumania',
    name: 'Carros de caballos: Rumanía rural',
    category: 'cultura',
    countries: ['ro'],
    visual: 'Carros de madera tirados por caballos circulando por la carretera, con heno o leña.',
    lookFor: 'El carro en vía asfaltada moderna es el contraste típico rumano.',
    howToUse:
      'Carro de caballos en Europa + lengua romance con ă → Rumanía (también existen en Ucrania rural: el idioma decide).',
    confidence: 'moderada',
    related: ['rumano-comas', 'carretera-sin-pintar'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'motos-vietnam',
    name: 'Mares de motos: Vietnam',
    category: 'cultura',
    countries: ['vn'],
    visual: 'Enjambres de scooters ocupando todo el ancho de la calle, conductores con mascarilla.',
    lookFor: 'La densidad de motos supera a la de coches por mucho.',
    howToUse:
      'Motos en masa + diacríticos apilados → Vietnam (Indonesia también tiene muchas: la escritura decide).',
    confidence: 'moderada',
    related: ['vietnamita-diacriticos', 'tube-houses-vietnam'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
]
