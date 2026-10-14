import type { Clue } from '../types'

const V = '2026-10-11'
const GH_ARCH = { name: 'GeoHints · Architecture', url: 'https://geohints.com/meta/architecture' }

export const CLUES_ARQUITECTURA: Clue[] = [
  {
    id: 'falu-rojo-nordico',
    name: 'Casas rojo falu con esquinas blancas',
    category: 'arquitectura',
    countries: ['se', 'no', 'fi'],
    visual:
      'Casas de madera pintadas de rojo oscuro mate (rojo falu) con marcos y esquinas blancos.',
    lookFor: 'El tono rojo apagado y uniforme repetido por todo el pueblo.',
    why: 'El pigmento de las minas de Falun (Suecia) fue el estándar barato durante siglos en toda la región.',
    howToUse:
      'Te sitúa en los Nórdicos (y Estonia rural). Para el país concreto, usa líneas, señales e idioma.',
    confidence: 'contextual',
    related: ['nordicos-linea-central', 'dano-noruego-vs-sueco'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
  {
    id: 'bloques-sovieticos',
    name: 'Bloques prefabricados soviéticos',
    category: 'arquitectura',
    countries: ['ru', 'ua', 'kz', 'ee', 'lv', 'lt', 'bg', 'ro'],
    visual:
      'Edificios de 5-9 plantas en paneles de hormigón, repetidos en hileras, a menudo con balcones cerrados de forma heterogénea.',
    lookFor:
      'La repetición idéntica del bloque y los balcones "customizados" por cada vecino.',
    why: 'Vivienda masiva estandarizada del bloque del Este (jrushchovkas y panelaks).',
    howToUse:
      'Ciudad con estos bloques → espacio ex-socialista: del Báltico a Asia Central y Balcanes. Decide país con alfabeto y matrículas.',
    confidence: 'contextual',
    related: ['cirilico-ruso-vs-ucraniano', 'bolardo-ruso'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
  {
    id: 'teja-arabe-mediterraneo',
    name: 'Teja árabe: el cinturón mediterráneo',
    category: 'arquitectura',
    countries: ['es', 'pt', 'it', 'gr', 'hr', 'tr'],
    visual: 'Tejados de teja curva naranja/terracota sobre muros claros.',
    lookFor:
      'Teja curva + luz dura + vegetación seca = Mediterráneo; también exportada a Latinoamérica.',
    howToUse:
      'Acota el clima, no el país. Cruza con idioma: teja + cirílico = Bulgaria/Balcanes; teja + ñ = España o Hispanoamérica.',
    confidence: 'contextual',
    related: ['olivos-mediterraneo', 'cirilico-bulgaro-serbio'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
  {
    id: 'azulejos-portugal',
    name: 'Azulejos y calzada portuguesa',
    category: 'arquitectura',
    countries: ['pt'],
    visual:
      'Fachadas cubiertas de azulejos cerámicos (a menudo azules/verdes) y aceras de adoquín blanco y negro en patrones.',
    lookFor: 'El brillo cerámico de la fachada y el mosaico del suelo.',
    howToUse:
      'Azulejos + "Rua" → Portugal (o Brasil colonial: mira matrículas y tierra roja).',
    confidence: 'fuerte',
    confusions: [
      { countries: ['br'], distinction: 'Brasil heredó azulejos en cascos históricos: las placas Mercosur y la vegetación deciden.' },
    ],
    related: ['espana-vs-portugal-idioma', 'portugues-tildes'],
    sources: [GH_ARCH, { name: 'Plonk It · Portugal', url: 'https://www.plonkit.net/portugal' }],
    verifiedAt: V,
  },
  {
    id: 'ladrillo-rebar-latam',
    name: 'Ladrillo sin revocar y varillas a la vista',
    category: 'arquitectura',
    countries: ['pe', 'bo', 'ec', 'mx', 'co'],
    visual:
      'Casas de ladrillo o bloque sin enlucir, con varillas de acero sobresaliendo del techo plano.',
    lookFor: 'Las varillas "esperando otra planta" y los frentes a medio pintar.',
    why: 'Construcción incremental: se deja la estructura lista para ampliar cuando haya dinero.',
    howToUse:
      'Muy común en los Andes y México; también en otras regiones en desarrollo (no es exclusiva de América: confírmalo con idioma).',
    confidence: 'contextual',
    related: ['andes-verdes', 'espanol-ene'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
  {
    id: 'madagascar-ladrillo',
    name: 'Madagascar: casas altas de ladrillo rojo',
    category: 'arquitectura',
    countries: ['mg'],
    visual:
      'Casas de dos plantas de ladrillo rojo visto con balcones y galerías de madera, tejados empinados.',
    lookFor: 'La verticalidad y el ladrillo artesanal: no parecen "África típica".',
    howToUse:
      'Estilo "normando de ladrillo" + colinas rojizas + arrozales → Madagascar con mucha confianza.',
    confidence: 'fuerte',
    related: ['madagascar-pickup'],
    sources: [GH_ARCH, { name: 'Plonk It · Madagascar', url: 'https://www.plonkit.net/madagascar' }],
    verifiedAt: V,
  },
  {
    id: 'rondavel-lesoto',
    name: 'Rondavels: Lesoto y Sudáfrica rural',
    category: 'arquitectura',
    countries: ['ls', 'za'],
    visual: 'Casas circulares de piedra o adobe con techo cónico de paja.',
    lookFor: 'La planta redonda; en Lesoto conviven con montaña de hierba a gran altitud.',
    howToUse:
      'Rondavels + altiplano frío → Lesoto; en lowveld sudafricano aparecen también en zonas rurales.',
    confidence: 'moderada',
    related: ['fynbos-cabo'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
  {
    id: 'tube-houses-vietnam',
    name: '"Tube houses" vietnamitas',
    category: 'arquitectura',
    countries: ['vn'],
    visual:
      'Casas de 3-5 plantas, MUY estrechas (un solo vano), fachadas de colores, a menudo exentas con laterales ciegos.',
    lookFor: 'La proporción torre-estrecha y la decoración solo en la fachada frontal.',
    why: 'El impuesto histórico por ancho de fachada incentivó construir estrecho y alto.',
    howToUse: 'Tube houses + diacríticos apilados → Vietnam seguro.',
    confidence: 'fuerte',
    related: ['vietnamita-diacriticos', 'motos-vietnam'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
  {
    id: 'suburbios-usa',
    name: 'Suburbio norteamericano',
    category: 'arquitectura',
    countries: ['us', 'ca'],
    visual:
      'Casas unifamiliares con revestimiento vinílico, garaje prominente, césped delantero SIN valla y buzón junto a la calle.',
    lookFor: 'La ausencia de vallas delanteras y el buzón de poste son los detalles delatores.',
    howToUse:
      'Separa Norteamérica de Australia/NZ (que vallan más y usan chapa) y de Europa (parcelas cerradas).',
    confidence: 'contextual',
    related: ['linea-central-amarilla', 'postes-madera-usa'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
  {
    id: 'butan-arquitectura',
    name: 'Bután: arquitectura tradicional obligatoria',
    category: 'arquitectura',
    countries: ['bt'],
    visual:
      'Todos los edificios con maderas pintadas, ventanas trapezoidales con arcos y frisos decorados, incluso gasolineras.',
    lookFor: 'La uniformidad del estilo: la ley obliga a construir en estilo tradicional.',
    howToUse: 'Himalaya + este estilo uniforme → Bután, no Nepal ni India.',
    confidence: 'fuerte',
    related: ['devanagari-vs-bengali'],
    sources: [GH_ARCH],
    verifiedAt: V,
  },
]
