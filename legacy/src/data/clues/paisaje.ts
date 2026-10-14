import type { Clue } from '../types'

const V = '2026-10-11'
const GH_NATURE = { name: 'GeoHints · Nature', url: 'https://geohints.com/meta/nature' }

export const CLUES_PAISAJE: Clue[] = [
  {
    id: 'eucaliptos-australia',
    name: 'Eucaliptos: Australia... y sus copias',
    category: 'paisaje',
    countries: ['au'],
    visual:
      'Árboles de corteza clara que pela en tiras, copa rala gris-verdosa, hojas colgantes.',
    lookFor: 'La corteza desprendida en la base y el verde apagado del follaje.',
    why: 'Género nativo australiano, plantado masivamente en otros climas secos.',
    howToUse:
      'En Oceanía: eucalipto apoya Australia frente a NZ. PERO está plantado en Portugal, España, África austral y Sudamérica: nunca decidas solo por el árbol.',
    confidence: 'moderada',
    exceptions: [
      'Portugal y Galicia están llenos de eucaliptos.',
      'Sudáfrica, Kenia, Etiopía, Uruguay y Chile tienen plantaciones extensas.',
    ],
    related: ['nz-helechos', 'fynbos-cabo'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'nz-helechos',
    name: 'Helechos arbóreos: Nueva Zelanda',
    category: 'paisaje',
    countries: ['nz'],
    visual: 'Helechos gigantes con tronco (ponga) en bordes de carretera húmedos y verdes.',
    lookFor: 'La silueta de palmera-helecho en sotobosque verde intenso.',
    howToUse:
      'Paisaje británico-verde + helecho arbóreo → Nueva Zelanda, no Reino Unido ni Australia seca.',
    confidence: 'moderada',
    related: ['maori-toponimos', 'eucaliptos-australia'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'fynbos-cabo',
    name: 'Fynbos: el Cabo sudafricano',
    category: 'paisaje',
    countries: ['za'],
    visual:
      'Matorral bajo denso de arbustos finos (proteas, brezos) sobre montañas de roca gris plegada.',
    lookFor: 'La combinación matorral fino + montaña rocosa + luz atlántica.',
    howToUse:
      'Fynbos → Western Cape, Sudáfrica. Si dudas con Australia: el fynbos es más denso y la montaña más dramática que el bush australiano.',
    confidence: 'fuerte',
    related: ['eucaliptos-australia', 'rondavel-lesoto'],
    sources: [GH_NATURE, { name: 'Plonk It · Sudáfrica', url: 'https://www.plonkit.net/south-africa' }],
    verifiedAt: V,
  },
  {
    id: 'tierra-roja-tropical',
    name: 'Tierra roja laterítica: trópicos',
    category: 'paisaje',
    countries: ['br', 'gh', 'ug', 'ke', 'mg', 'kh'],
    visual: 'Suelo y arcenes de color rojo-naranja intenso; polvo rojo sobre vegetación.',
    lookFor: 'El contraste rojo/verde en caminos sin asfaltar.',
    why: 'Suelos lateríticos ricos en óxidos de hierro, típicos de climas tropicales.',
    howToUse:
      'Acota a trópicos (África, Brasil interior, Sudeste Asiático). Cruza con idioma y sentido de circulación para elegir continente.',
    confidence: 'contextual',
    related: ['izquierda-mundo', 'carretera-sin-pintar'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'pampa-uy-ar',
    name: 'Pampa: praderas del Cono Sur',
    category: 'paisaje',
    countries: ['ar', 'uy'],
    visual:
      'Pradera suave sin fin, ganado, alambrados, álamos o eucaliptos como cortavientos.',
    lookFor:
      'Argentina pampeana: horizonte plano total. Uruguay: lomas suaves, palmeras sueltas, más piedra.',
    howToUse:
      'Pampa + PARE + español → Cono Sur; usa relieve (lomas = Uruguay) y rutas RN/RP (Argentina) para separar.',
    confidence: 'contextual',
    related: ['matricula-mercosur', 'gauchito-gil'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'andes-verdes',
    name: 'Andes del norte: montaña verde perpetua',
    category: 'paisaje',
    countries: ['co', 'ec'],
    visual:
      'Laderas empinadas y verdes con cultivos en pendiente, niebla frecuente, carreteras en balcón.',
    lookFor: 'Verde intenso + pendiente constante: ni la aridez peruana ni la pampa.',
    howToUse:
      'Montaña verde + español → Colombia o Ecuador; matrícula amarilla decide Colombia.',
    confidence: 'contextual',
    related: ['matricula-colombia-amarilla', 'altiplano-andino'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'altiplano-andino',
    name: 'Altiplano: Perú y Bolivia a 4000 m',
    category: 'paisaje',
    countries: ['pe', 'bo'],
    visual:
      'Meseta parda y seca con luz durísima, cerros pelados, adobe, cielo azul oscuro.',
    lookFor: 'La sensación de altura: sombras duras, poca vegetación, llamas/alpacas.',
    howToUse:
      'Altiplano + ladrillo visto → Perú o Bolivia; El Alto boliviano tiene "cholets" de colores; la costa desértica gris es Perú.',
    confidence: 'contextual',
    related: ['ladrillo-rebar-latam'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'taiga-abedules',
    name: 'Taiga y abedules: cinturón boreal',
    category: 'paisaje',
    countries: ['fi', 'se', 'no', 'ee', 'lv', 'ru', 'ca'],
    visual: 'Bosque de pinos/abetos con abedules de tronco blanco, suelo de musgo y arándano.',
    lookFor: 'El abedul blanco es el marcador; con hierba alta y desorden → Rusia/Báltico; cuidado perfecto → Nórdicos.',
    howToUse:
      'Define el cinturón boreal (Norte de Europa, Rusia, Canadá). Las líneas de la carretera y el idioma deciden el país.',
    confidence: 'contextual',
    related: ['nordicos-linea-central', 'carretera-sin-pintar'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'estepa-mongolia',
    name: 'Estepa sin vallas: Mongolia',
    category: 'paisaje',
    countries: ['mn', 'kz'],
    visual:
      'Pradera rasa infinita sin árboles NI VALLAS, con varias rodadas de tierra en paralelo y ganado suelto.',
    lookFor: 'Las pistas múltiples paralelas (cada coche abre la suya) y los gers blancos.',
    howToUse:
      'Pistas paralelas + ger → Mongolia. Estepa con infraestructura asfaltada y cirílico kazajo → Kazajistán.',
    confidence: 'fuerte',
    related: ['cirilico-kazajo', 'carretera-sin-pintar'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'arrozales-sudeste',
    name: 'Arrozales: Asia monzónica',
    category: 'paisaje',
    countries: ['vn', 'th', 'kh', 'id', 'ph', 'lk', 'bd'],
    visual: 'Parcelas inundadas de verde eléctrico, diques de tierra, búfalos de agua.',
    lookFor: 'El verde del arroz joven es casi fosforescente; terrazas si hay pendiente.',
    howToUse:
      'Sitúa el sudeste/sur de Asia; la escritura y el sentido de circulación eligen el país.',
    confidence: 'contextual',
    related: ['tailandes-lao-jemer-birmano', 'vecinos-sentido-opuesto'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'palma-aceitera',
    name: 'Palma aceitera: Malasia e Indonesia',
    category: 'paisaje',
    countries: ['my', 'id'],
    visual:
      'Hileras interminables de palmas idénticas de tronco grueso y rugoso, suelo limpio y sombrío.',
    lookFor: 'La monotonía de plantación (no es selva): filas ordenadas kilómetro tras kilómetro.',
    howToUse:
      'Plantación de palma → Malasia o Indonesia (también África Occidental a menor escala). Decide con matrículas y carteles.',
    confidence: 'moderada',
    related: ['indonesia-vs-malasia', 'jalan-sudeste'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
  {
    id: 'islandia-sin-arboles',
    name: 'Islandia: paisaje sin árboles',
    category: 'paisaje',
    countries: ['is'],
    visual:
      'Campos de lava con musgo, montañas oscuras sin vegetación alta, cielo dramático.',
    lookFor: 'La ausencia casi total de árboles + lava negra + hierba rasa.',
    howToUse:
      'Treeless volcánico + línea central amarilla → Islandia (las Feroe son parecidas pero más verdes y abruptas).',
    confidence: 'fuerte',
    related: ['islandes-letras', 'linea-central-amarilla'],
    sources: [GH_NATURE],
    verifiedAt: V,
  },
]
