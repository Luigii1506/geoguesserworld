import type { Clue } from '../types'

const V = '2026-10-11'
const GH_LINES = { name: 'GeoHints · Lines', url: 'https://geohints.com/meta/lines' }
const PLONKIT = { name: 'Plonk It · Índice de guías', url: 'https://www.plonkit.net/guide' }

export const CLUES_LINEAS: Clue[] = [
  {
    id: 'linea-central-amarilla',
    name: 'Línea central amarilla',
    category: 'lineas-viales',
    countries: ['us', 'ca', 'mx', 'br', 'ar', 'cl', 'pe', 'co', 'no', 'is', 'kr'],
    visual:
      'La línea que separa los dos sentidos de circulación es amarilla (continua o discontinua); los bordes suelen ser blancos.',
    lookFor:
      'Mira el color de la línea CENTRAL, no la de los bordes. Con nieve o polvo, busca un tramo de asfalto limpio o un cruce.',
    why:
      'América adoptó el amarillo del estándar MUTCD de EE. UU. para separar sentidos; la mayor parte de Europa usa blanco para todo.',
    howToUse:
      'En una ronda que parece Europa: central amarilla reduce casi todo a Noruega o Islandia (o cobertura antigua de Finlandia). Si parece América, no discrimina: casi todo el continente la usa.',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['no', 'is', 'fi'],
        distinction:
          'Noruega: fiordos y túneles. Islandia: sin árboles, lava. Finlandia hoy pinta blanco, pero la cobertura vieja puede mostrar amarillo.',
      },
    ],
    exceptions: [
      'Finlandia cambió a líneas blancas; según el año de la imagen verás uno u otro color.',
      'En Asia el amarillo central también existe (Corea del Sur, partes de Japón): confirma con escritura.',
    ],
    related: ['nordicos-linea-central', 'irlanda-lateral-amarilla'],
    sources: [GH_LINES, PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'nordicos-linea-central',
    name: 'Nórdicos: separar por color de línea',
    category: 'lineas-viales',
    countries: ['no', 'se', 'fi', 'is', 'dk'],
    visual:
      'Paisaje boreal de pinos y abedules con carretera bien pintada: el color de la central decide entre países casi idénticos.',
    lookFor:
      'Central amarilla → Noruega o Islandia. Todo blanco → Suecia, Dinamarca o Finlandia actual.',
    howToUse:
      'Primera pregunta ante una ronda nórdica. Después confirma con idioma (ø/æ vs ö/ä), señales (fondo amarillo vs blanco danés) y relieve (fiordos = Noruega, llano = Finlandia/Dinamarca).',
    confidence: 'fuerte',
    exceptions: [
      'Cobertura antigua de Finlandia con líneas amarillas.',
      'Carreteras forestales sin pintar no dicen nada: busca otra pista.',
    ],
    related: ['linea-central-amarilla', 'dano-noruego-vs-sueco', 'advertencia-amarilla-nordica', 'suecia-2mas1'],
    sources: [GH_LINES, { name: 'Plonk It · Noruega', url: 'https://www.plonkit.net/norway' }],
    verifiedAt: V,
  },
  {
    id: 'uk-doble-amarilla-bordillo',
    name: 'Doble línea amarilla junto al bordillo (UK)',
    category: 'lineas-viales',
    countries: ['gb', 'ie'],
    visual:
      'Dos líneas amarillas finas pintadas pegadas al bordillo de la acera, siguiendo la calle.',
    lookFor:
      'No es una línea de tráfico: va junto a la acera y marca prohibición de aparcar.',
    why: 'Sistema británico de restricción de estacionamiento (single/double yellow lines).',
    howToUse:
      'En una ciudad anglosajona, estas líneas apuntan con fuerza a Reino Unido (Irlanda también las usa). Combínalo con conducción por la izquierda y ladrillo.',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['ie'],
        distinction:
          'Irlanda también las pinta: separa por señales (rombos amarillos estilo americano en Irlanda) y bilingüismo irlandés.',
      },
    ],
    related: ['irlanda-lateral-amarilla', 'izquierda-mundo'],
    sources: [{ name: 'Plonk It · Reino Unido', url: 'https://www.plonkit.net/united-kingdom' }],
    verifiedAt: V,
  },
  {
    id: 'irlanda-lateral-amarilla',
    name: 'Línea lateral amarilla discontinua (Irlanda)',
    category: 'lineas-viales',
    countries: ['ie'],
    visual:
      'El borde exterior de la calzada lleva una línea AMARILLA discontinua; la central es blanca.',
    lookFor:
      'Fíjate en el borde, no en el centro: amarillo al borde + central blanca es la combinación irlandesa.',
    howToUse:
      'Permite separar Irlanda de Reino Unido en segundos, antes incluso de leer una señal.',
    confidence: 'fuerte',
    related: ['uk-doble-amarilla-bordillo', 'advertencia-rombo-amarillo'],
    sources: [{ name: 'Plonk It · Irlanda', url: 'https://www.plonkit.net/ireland' }],
    verifiedAt: V,
  },
  {
    id: 'suecia-2mas1',
    name: 'Carreteras 2+1 con barrera de cable (Suecia)',
    category: 'lineas-viales',
    countries: ['se'],
    visual:
      'Carretera que alterna 2 carriles en un sentido y 1 en el otro, separados por una barrera de cables de acero sobre postes.',
    lookFor:
      'La barrera central de cable tensado es lo distintivo; el patrón 2+1 cambia de lado cada pocos km.',
    why: 'Suecia fue pionera en este diseño de seguridad vial y lo ha desplegado masivamente.',
    howToUse:
      'En una carretera principal nórdica, la barrera de cable central inclina fuerte hacia Suecia.',
    confidence: 'moderada',
    exceptions: ['Otros países (Irlanda, Dinamarca...) han copiado el diseño, pero con mucha menos densidad.'],
    related: ['nordicos-linea-central'],
    sources: [{ name: 'Plonk It · Suecia', url: 'https://www.plonkit.net/sweden' }],
    verifiedAt: V,
  },
  {
    id: 'carretera-sin-pintar',
    name: 'Carretera sin líneas: lee el contexto',
    category: 'lineas-viales',
    countries: [],
    visual:
      'Asfalto o grava sin ninguna marca vial.',
    lookFor:
      'El ancho, el material (grava roja, asfalto gris, hormigón en placas) y el arcén dicen más que la ausencia de pintura.',
    howToUse:
      'No fuerces una conclusión: una rural sin pintar existe en todo el mundo. Grava clara + bosque boreal → Báltico/Escandinavia/Rusia; tierra roja → trópicos; hormigón en placas → ex-URSS o México rural.',
    confidence: 'contextual',
    related: ['taiga-abedules', 'tierra-roja-tropical'],
    sources: [GH_LINES],
    verifiedAt: V,
  },
]
