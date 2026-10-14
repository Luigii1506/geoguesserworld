import type { Clue } from '../types'

const V = '2026-10-11'
const GH_POLES = { name: 'GeoHints · Utility Poles', url: 'https://geohints.com/meta/utilityPoles' }

export const CLUES_POSTES: Clue[] = [
  {
    id: 'postes-como-pista',
    name: 'Postes: material y silueta',
    category: 'postes',
    countries: [],
    visual:
      'Postes eléctricos/telefónicos: madera, hormigón o metal; con travesaños, ménsulas o cables en fachada.',
    lookFor:
      'Material del poste, forma del tope, número de travesaños y tipo de aisladores. Están en casi cada imagen: aprende a leerlos.',
    why:
      'Las compañías eléctricas nacionales estandarizan sus postes: el diseño se repite por todo el país.',
    howToUse:
      'Madera → Norteamérica, Nórdicos, parte de Europa. Hormigón → ex-URSS, Mediterráneo, Asia Oriental, Latinoamérica. Celosía metálica → España/Portugal rural, Italia.',
    confidence: 'contextual',
    related: ['postes-hungria', 'postes-japon'],
    sources: [GH_POLES],
    verifiedAt: V,
  },
  {
    id: 'postes-hungria',
    name: 'Hungría: hormigón con agujeros',
    category: 'postes',
    countries: ['hu'],
    visual:
      'Postes de hormigón con una fila de AGUJEROS rectangulares a lo largo (aspecto de escalera).',
    lookFor: 'Los huecos pasantes del cuerpo del poste; se ven a contraluz fácilmente.',
    howToUse:
      'Postes perforados + llanura agrícola → Hungría con mucha confianza; confirma con ő/ű o "utca".',
    confidence: 'fuerte',
    exceptions: ['Diseños perforados existen puntualmente en países vecinos; la densidad húngara es la pista.'],
    related: ['hungaro-doble-acento', 'utca-hungria'],
    sources: [GH_POLES, { name: 'Plonk It · Hungría', url: 'https://www.plonkit.net/hungary' }],
    verifiedAt: V,
  },
  {
    id: 'postes-japon',
    name: 'Japón: hormigón y transformadores cilíndricos',
    category: 'postes',
    countries: ['jp'],
    visual:
      'Postes de hormigón gris con transformadores cilíndricos y marañas ordenadas de cables sobre calles estrechas.',
    lookFor: 'Los cilindros grises (transformadores) montados en lo alto del poste.',
    why: 'Japón mantiene la distribución eléctrica aérea incluso en ciudades.',
    howToUse:
      'Cielo urbano "cableado" + kanji → Japón. Corea del Sur es similar: decide con hangul vs kana.',
    confidence: 'moderada',
    confusions: [
      { countries: ['kr', 'tw'], distinction: 'Corea y Taiwán también cablean mucho: el alfabeto decide.' },
    ],
    related: ['japones-vs-coreano-vs-chino', 'stop-japon-triangulo'],
    sources: [GH_POLES],
    verifiedAt: V,
  },
  {
    id: 'postes-madera-usa',
    name: 'Norteamérica: madera alta con travesaño',
    category: 'postes',
    countries: ['us', 'ca'],
    visual:
      'Postes de madera altos, marrón oscuro, con travesaño horizontal y cables en varios niveles.',
    lookFor: 'La madera sin pintar y la altura; a menudo con transformador de cuba gris.',
    howToUse:
      'Refuerza Norteamérica frente a Europa (donde la madera es más baja y rara fuera de los Nórdicos).',
    confidence: 'contextual',
    related: ['linea-central-amarilla', 'suburbios-usa'],
    sources: [GH_POLES],
    verifiedAt: V,
  },
  {
    id: 'postes-exsovieticos',
    name: 'Ex-URSS: hormigón con tirante diagonal',
    category: 'postes',
    countries: ['ru', 'ua', 'kz', 'kg'],
    visual:
      'Postes de hormigón (a menudo de sección rectangular) apoyados por un segundo poste diagonal, formando una "A" abierta.',
    lookFor: 'El tirante diagonal de hormigón y la tosquedad del acabado.',
    howToUse:
      'Te sitúa en el espacio post-soviético; decide el país con el alfabeto (ы rusa, і ucraniana, ә kazaja).',
    confidence: 'moderada',
    related: ['cirilico-ruso-vs-ucraniano', 'cirilico-kazajo'],
    sources: [GH_POLES],
    verifiedAt: V,
  },
  {
    id: 'postes-tropicos-hormigon',
    name: 'Trópicos asiáticos: hormigón cuadrado y marañas',
    category: 'postes',
    countries: ['th', 'vn', 'ph', 'id'],
    visual:
      'Postes de hormigón de sección cuadrada con enormes marañas de cable negro a baja altura.',
    lookFor: 'La sección CUADRADA del poste (Tailandia es el caso clásico) y el caos de cables.',
    howToUse:
      'Hormigón cuadrado + escritura tailandesa = Tailandia. En Vietnam y Filipinas el caos de cables es similar: decide con el idioma.',
    confidence: 'moderada',
    related: ['tailandes-lao-jemer-birmano', 'vietnamita-diacriticos'],
    sources: [GH_POLES],
    verifiedAt: V,
  },
]
