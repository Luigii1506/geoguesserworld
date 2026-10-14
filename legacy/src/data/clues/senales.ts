import type { Clue } from '../types'

const V = '2026-10-11'
const GH_SIGNS = { name: 'GeoHints · Signs', url: 'https://geohints.com/meta/signs/stop' }

export const CLUES_SENALES: Clue[] = [
  {
    id: 'advertencia-amarilla-nordica',
    name: 'Advertencias con fondo amarillo',
    category: 'senales',
    countries: ['se', 'fi', 'is', 'no', 'pl', 'gr'],
    visual:
      'Triángulos de advertencia con borde rojo y fondo AMARILLO en lugar de blanco.',
    lookFor:
      'Cualquier señal triangular sirve: curva, alces, obras. Compara el fondo con el blanco del resto de señales.',
    why:
      'Los países con mucha nieve eligieron fondo amarillo para que la señal no se pierda contra el paisaje nevado.',
    howToUse:
      'En una ronda nórdica: fondo amarillo descarta DINAMARCA (fondo blanco). En Europa Central: fondo amarillo apunta a Polonia frente a Chequia/Alemania (blanco).',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['dk', 'de', 'cz'],
        distinction: 'Dinamarca, Alemania y Chequia usan fondo blanco: la comparación directa decide.',
      },
    ],
    exceptions: [
      'Grecia y varios países balcánicos también usan fondo amarillo: confirma con el alfabeto.',
    ],
    related: ['nordicos-linea-central', 'bolardo-polaco'],
    sources: [GH_SIGNS, { name: 'Plonk It · Suecia', url: 'https://www.plonkit.net/sweden' }],
    verifiedAt: V,
  },
  {
    id: 'stop-japon-triangulo',
    name: 'STOP japonés: triángulo rojo invertido',
    category: 'senales',
    countries: ['jp'],
    visual:
      'La señal de stop es un TRIÁNGULO rojo invertido con 止まれ en blanco (las nuevas añaden "STOP").',
    lookFor:
      'Forma triangular, no octogonal. También existe pintado en el asfalto: 止まれ.',
    why: 'Japón mantiene su diseño pre-convención de Viena.',
    howToUse: 'Visto el triángulo rojo invertido, es Japón. Evidencia suficiente por sí sola.',
    confidence: 'fuerte',
    related: ['japones-vs-coreano-vs-chino', 'postes-japon'],
    sources: [GH_SIGNS, { name: 'Plonk It · Japón', url: 'https://www.plonkit.net/japan' }],
    verifiedAt: V,
  },
  {
    id: 'alto-vs-pare',
    name: 'ALTO vs PARE',
    category: 'senales',
    countries: ['mx', 'gt', 'co', 'pe', 'ar', 'cl', 'uy', 'ec', 'br'],
    visual:
      'El octógono rojo dice "ALTO" en México y buena parte de Centroamérica; "PARE" en Sudamérica (también en Brasil, en portugués).',
    lookFor: 'Una sola palabra en el octógono basta para partir el continente en dos.',
    howToUse:
      'ALTO → México/Centroamérica. PARE → Sudamérica (y Caribe hispano variado). PARE + ã/õ en otros carteles → Brasil.',
    confidence: 'fuerte',
    exceptions: ['República Dominicana usa PARE pese a estar en el Caribe norte.'],
    related: ['portugues-tildes', 'mexico-topes'],
    sources: [GH_SIGNS],
    verifiedAt: V,
  },
  {
    id: 'arret-quebec',
    name: 'ARRÊT: el stop de Quebec',
    category: 'senales',
    countries: ['ca'],
    visual: 'Octógono rojo con "ARRÊT" (a veces "ARRÊT/STOP").',
    lookFor: 'La palabra francesa en el octógono.',
    why: 'La ley lingüística de Quebec prioriza el francés en señalización.',
    howToUse:
      'ARRÊT → Quebec, Canadá. Francés + línea central amarilla + postes de madera = Quebec, no Francia.',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['fr'],
        distinction:
          'Francia usa octógono "STOP", línea central blanca y bolardos con banda roja; Quebec tiene estética norteamericana.',
      },
    ],
    related: ['linea-central-amarilla'],
    sources: [GH_SIGNS, { name: 'Plonk It · Canadá', url: 'https://www.plonkit.net/canada' }],
    verifiedAt: V,
  },
  {
    id: 'advertencia-rombo-amarillo',
    name: 'Advertencia en rombo amarillo vs triángulo',
    category: 'senales',
    countries: ['us', 'ca', 'mx', 'br', 'ar', 'au', 'nz', 'ie', 'jp', 'th', 'my', 'id'],
    visual:
      'Las señales de advertencia son ROMBOS amarillos (estilo MUTCD) en lugar de triángulos con borde rojo.',
    lookFor: 'La forma, aunque no entiendas el pictograma ni el idioma.',
    why:
      'Dos familias de normas: convención de Viena (triángulos, Europa/África) vs MUTCD y derivados (rombos, América/Oceanía/gran parte de Asia).',
    howToUse:
      'Rombo amarillo descarta Europa continental de un plumazo (excepto Irlanda, que usa rombos). Triángulo rojo descarta América.',
    confidence: 'fuerte',
    exceptions: ['Irlanda es la excepción europea con rombos amarillos.'],
    related: ['alto-vs-pare', 'irlanda-lateral-amarilla'],
    sources: [GH_SIGNS],
    verifiedAt: V,
  },
  {
    id: 'colores-carteles-autopista',
    name: 'Color de carteles: autopista verde o azul',
    category: 'senales',
    countries: ['it', 'ch', 'es', 'fr', 'de', 'gb'],
    visual:
      'Los carteles direccionales grandes son azules en unos países y verdes en otros, con significado invertido según el país.',
    lookFor:
      'Italia y Suiza: VERDE = autopista, azul = carretera normal. España, Francia y Alemania: AZUL = autopista, blanco/verde = resto. Reino Unido: azul = motorway, verde = primaria.',
    howToUse:
      'Con un solo cartel grande puedes separar Italia/Suiza de Francia/España/Alemania. Memoriza el par verde-azul de cada país grande.',
    confidence: 'fuerte',
    related: ['bolardo-frances', 'bolardo-aleman-austriaco'],
    sources: [{ name: 'GeoTips · Europa', url: 'https://geotips.net/europe/' }],
    verifiedAt: V,
  },
  {
    id: 'senales-bilingues',
    name: 'Señales bilingües: qué par de lenguas ves',
    category: 'senales',
    countries: ['ie', 'gb', 'be', 'ch', 'ca', 'fi', 'il', 'tn', 'in', 'lk'],
    visual:
      'Dos lenguas o dos alfabetos conviviendo en la misma señal.',
    lookFor:
      'Identifica el PAR: irlandés+inglés (Irlanda), galés+inglés (Gales), neerlandés+francés (Bruselas), sueco+finés (costa finlandesa), hebreo+árabe+latino (Israel), árabe+francés (Magreb), cingalés+tamil+inglés (Sri Lanka).',
    howToUse:
      'El par de lenguas suele ser más específico que cualquier lengua por separado: fija país e incluso región.',
    confidence: 'fuerte',
    related: ['fines-estonio', 'hebreo-vs-arabe'],
    sources: [{ name: 'Plonk It · Índice de guías', url: 'https://www.plonkit.net/guide' }],
    verifiedAt: V,
  },
  {
    id: 'chevrones-curva',
    name: 'Chevrones de curva: paleta por país',
    category: 'senales',
    countries: [],
    visual:
      'Paneles con flechas angulares marcando curvas cerradas; la combinación de colores varía por país.',
    lookFor:
      'Color de fondo + color de flecha. Hay pocas combinaciones y varios países las comparten: útil para acotar, no para decidir.',
    howToUse:
      'Úsalo como pista de apoyo; consulta la tabla comparativa de GeoHints hasta memorizar las combinaciones frecuentes.',
    confidence: 'verificar',
    exceptions: ['Pendiente de fichar las combinaciones concretas por país con verificación propia.'],
    related: ['bolardos-como-usarlos'],
    sources: [{ name: 'GeoHints · Chevrons', url: 'https://geohints.com/meta/signs/chevrons' }],
    verifiedAt: V,
  },
]
