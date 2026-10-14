import type { Clue } from '../types'

const V = '2026-10-11'
const GH_GENS = { name: 'GeoHints · Camera Generations', url: 'https://geohints.com/meta/cameraGens' }
const GH_FOLLOW = { name: 'GeoHints · Follow Cars', url: 'https://geohints.com/meta/followCars' }
const VS = { name: 'VirtualStreets · Cobertura', url: 'https://virtualstreets.org/index.php/svcoverage/' }

// Todo lo de este archivo es "meta": depende de la cobertura de Street View
// en un momento dado y PUEDE CADUCAR con cada actualización de Google.

export const CLUES_META: Clue[] = [
  {
    id: 'generaciones-camara',
    name: 'Generaciones de cámara de Google',
    category: 'meta-camara',
    countries: [],
    visual:
      'Gen 1: resolución baja, colores lavados (cobertura muy antigua). Gen 2: mejor pero borrosa en los bordes. Gen 3: nítida con colores suaves y halo frecuente alrededor del sol. Gen 4: HDR vívido, contraste alto, azul intenso.',
    lookFor:
      'Calidad de imagen, tamaño del difuminado inferior (coche) y el halo solar de Gen 3.',
    why:
      'Google renovó el hardware por oleadas; cada país recibió generaciones concretas en años concretos.',
    howToUse:
      'La generación acota país y época: p. ej., mucha cobertura africana y asiática es Gen 3; Gen 4 domina en América y Europa recientes. Úsala para confirmar, no como única pista.',
    confidence: 'meta',
    exceptions: ['Las re-coberturas mezclan generaciones en un mismo país.'],
    related: ['kenia-snorkel', 'alemania-cobertura'],
    sources: [GH_GENS, { name: 'GeoTips · Camera Types', url: 'https://geotips.net/resources/' }],
    verifiedAt: V,
  },
  {
    id: 'kenia-snorkel',
    name: 'Kenia: el snorkel del coche',
    category: 'meta-camara',
    countries: ['ke'],
    visual:
      'Tubo negro (snorkel de admisión) visible en la esquina frontal derecha del coche de Google.',
    lookFor: 'Mira hacia abajo y al frente-derecha: el tubo sube junto al parabrisas.',
    why: 'La cobertura keniana se grabó con un 4x4 preparado con snorkel.',
    howToUse:
      'Sabana + conducción izquierda + snorkel → Kenia, no Tanzania ni Sudáfrica.',
    confidence: 'meta',
    exceptions: ['Cobertura nueva puede usar otro vehículo: si no hay snorkel, no descartes Kenia.'],
    related: ['generaciones-camara', 'tierra-roja-tropical'],
    sources: [GH_FOLLOW, { name: 'Plonk It · Kenia', url: 'https://www.plonkit.net/kenya' }],
    verifiedAt: V,
  },
  {
    id: 'nigeria-escolta',
    name: 'Nigeria: coche escolta',
    category: 'meta-camara',
    countries: ['ng'],
    visual:
      'Un vehículo (a menudo de policía o camioneta) acompaña al coche de Google y aparece constantemente en la imagen.',
    lookFor: 'El mismo vehículo repetido delante o detrás en toda la ronda.',
    why: 'La cobertura nigeriana se grabó con escolta de seguridad.',
    howToUse: 'África Occidental + escolta persistente → Nigeria.',
    confidence: 'meta',
    related: ['generaciones-camara'],
    sources: [GH_FOLLOW],
    verifiedAt: V,
  },
  {
    id: 'ghana-cinta',
    name: 'Ghana: cinta en el coche',
    category: 'meta-camara',
    countries: ['gh'],
    visual: 'Fragmento de cinta/carrocería negra visible en una esquina del difuminado inferior.',
    lookFor: 'Mira al suelo: la mancha negra en el borde del coche es el "tell" ghanés clásico.',
    howToUse:
      'África Occidental anglófona + marca negra en el coche → Ghana. Verifícalo con tus propias partidas: es un detalle fino.',
    confidence: 'verificar',
    related: ['nigeria-escolta', 'tierra-roja-tropical'],
    sources: [GH_FOLLOW, { name: 'Plonk It · Ghana', url: 'https://www.plonkit.net/ghana' }],
    verifiedAt: V,
  },
  {
    id: 'madagascar-pickup',
    name: 'Madagascar: cámara en pickup',
    category: 'meta-camara',
    countries: ['mg'],
    visual:
      'Gran parte de la cobertura se grabó desde la caja de una camioneta: se ve la caja o sus bordes al mirar abajo.',
    lookFor: 'La caja del vehículo y una altura de cámara distinta a la habitual.',
    howToUse: 'África insular + pickup visible → Madagascar.',
    confidence: 'meta',
    related: ['madagascar-ladrillo'],
    sources: [GH_FOLLOW],
    verifiedAt: V,
  },
  {
    id: 'alemania-cobertura',
    name: 'Alemania: cobertura vieja y edificios borrosos',
    category: 'meta-cobertura',
    countries: ['de'],
    visual:
      'Imágenes de 2008-09 de baja calidad en ciudades, con MUCHOS edificios difuminados por peticiones de privacidad.',
    lookFor: 'Casas enteras borrosas + calidad antigua = Alemania clásica de GeoGuessr.',
    why:
      'La ley de privacidad alemana permitió exigir el difuminado; Google congeló la cobertura durante años (renovada desde 2023).',
    howToUse:
      'Edificio borroso + alemán → Alemania, no Austria/Suiza. En cobertura nueva (Gen 4) esta pista desaparece.',
    confidence: 'meta',
    related: ['bolardo-aleman-austriaco', 'generaciones-camara'],
    sources: [VS, { name: 'Plonk It · Alemania', url: 'https://www.plonkit.net/germany' }],
    verifiedAt: V,
  },
  {
    id: 'paises-sin-cobertura',
    name: 'Dónde NO puede estar la ronda',
    category: 'meta-cobertura',
    countries: [],
    visual: 'Conocer los países sin cobertura oficial evita apuestas imposibles.',
    lookFor:
      'Sin cobertura oficial de coche (o solo photospheres/trekker): China, Marruecos, Argelia, Libia, Egipto (casi), Cuba, Venezuela, Paraguay (histórico), Irán, Arabia Saudí (parcial), la mayor parte de Asia Central salvo Kazajistán/Kirguistán, y gran parte de África central-occidental.',
    howToUse:
      'Si crees ver "Marruecos", casi seguro es Túnez o el sur de España; si parece "China", prueba Taiwán, Hong Kong o barrios chinos. Esta lista cambia: revisa noticias de cobertura.',
    confidence: 'meta',
    exceptions: ['Google añade países cada año: verifica la lista periódicamente en VirtualStreets.'],
    related: ['alemania-cobertura'],
    sources: [VS, { name: 'Geometas · Country Coverage', url: 'https://geometas.com/learn/geoguessr_country_coverage/' }],
    verifiedAt: V,
  },
  {
    id: 'trekker-panoramas',
    name: 'Trekker y photospheres: cobertura a pie',
    category: 'meta-cobertura',
    countries: ['np', 'bt'],
    visual:
      'Imágenes tomadas a pie (mochila trekker) en senderos, o esferas estáticas subidas por usuarios con calidad variable.',
    lookFor:
      'Altura de cámara baja, sombra de persona, imposibilidad de "conducir": estás en trekker o photosphere.',
    howToUse:
      'En trekker piensa en atracciones: senderos de Nepal, parques nacionales, islas. En photospheres, la calidad y el trípode delatan al autor local.',
    confidence: 'meta',
    related: ['paises-sin-cobertura'],
    sources: [VS],
    verifiedAt: V,
  },
  {
    id: 'mongolia-offroad',
    name: 'Mongolia: cobertura campo a través',
    category: 'meta-cobertura',
    countries: ['mn'],
    visual: 'El coche de Google circula por pistas de tierra abiertas, lejos de toda carretera.',
    lookFor: 'Rodadas múltiples y ausencia total de infraestructura.',
    howToUse:
      'Cobertura "sin carretera" en estepa → Mongolia es el caso arquetípico.',
    confidence: 'meta',
    related: ['estepa-mongolia', 'cirilico-kazajo'],
    sources: [VS],
    verifiedAt: V,
  },
  {
    id: 'modos-juego',
    name: 'Mover, No Move y NMPZ: qué pistas sobreviven',
    category: 'meta-cobertura',
    countries: [],
    visual: 'El modo de juego cambia qué pistas puedes usar.',
    lookFor:
      'Moving: todo vale, busca cruces y carteles. No Move: prioriza lo visible desde el punto (sol, líneas, postes, vegetación). NMPZ (sin mover/girar/zoom): solo lo que tienes delante; el meta del coche y los colores pesan el doble.',
    howToUse:
      'Entrena cada pista pensando en NMPZ: si sabes leerla sin zoom, en modos fáciles serás más rápido.',
    confidence: 'fuerte',
    related: ['generaciones-camara', 'detectar-sentido'],
    sources: [{ name: 'Learnable Meta · Getting started', url: 'https://learnablemeta.com/docs/getting-started' }],
    verifiedAt: V,
  },
]
