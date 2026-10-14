import type { Clue } from '../types'

const V = '2026-10-11'
const GH_PLATES = { name: 'GeoHints · License Plates', url: 'https://geohints.com/meta/licensePlates' }

export const CLUES_MATRICULAS: Clue[] = [
  {
    id: 'matriculas-europa-franja',
    name: 'Franja azul UE en el lateral izquierdo',
    category: 'matriculas',
    countries: ['es', 'fr', 'de', 'it', 'pl', 'pt', 'ro', 'nl'],
    visual:
      'Matrícula blanca con banda azul vertical a la izquierda (estrellas UE + código de país), visible incluso borrosa.',
    lookFor:
      'Aunque el número esté difuminado, el bloque azul del borde izquierdo se distingue. Suiza y otros no-UE no la llevan.',
    howToUse:
      'Franja azul → país de la UE. Sin franja en un entorno claramente europeo → piensa en Suiza, Noruega (franja distinta), Balcanes no-UE o Reino Unido post-UE.',
    confidence: 'moderada',
    related: ['matricula-nl-amarilla', 'matricula-be-roja'],
    sources: [GH_PLATES],
    verifiedAt: V,
  },
  {
    id: 'matricula-nl-amarilla',
    name: 'Matrículas amarillas por delante y detrás',
    category: 'matriculas',
    countries: ['nl', 'lu', 'il'],
    visual: 'Ambas matrículas de color amarillo intenso.',
    lookFor:
      'Delantera Y trasera amarillas. Reino Unido solo lleva amarilla la TRASERA (delantera blanca); Luxemburgo, amarilla trasera.',
    howToUse:
      'En Europa continental, coches con ambas placas amarillas → Países Bajos casi seguro. Amarillas en Oriente Próximo → Israel.',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['gb', 'lu'],
        distinction:
          'UK: blanca delante/amarilla detrás + conducción izquierda. Luxemburgo: trasera amarilla, delantera blanca, país diminuto.',
      },
    ],
    related: ['matriculas-europa-franja'],
    sources: [GH_PLATES, { name: 'Plonk It · Países Bajos', url: 'https://www.plonkit.net/netherlands' }],
    verifiedAt: V,
  },
  {
    id: 'matricula-be-roja',
    name: 'Bélgica: caracteres rojos',
    category: 'matriculas',
    countries: ['be'],
    visual: 'Matrícula blanca con números y letras de color ROJO rubí.',
    lookFor: 'El tono rojizo del texto se percibe incluso con el difuminado de Street View.',
    howToUse: 'Texto rojizo en matrícula europea → Bélgica. Pista rápida y poco conocida.',
    confidence: 'fuerte',
    related: ['matriculas-europa-franja'],
    sources: [GH_PLATES, { name: 'Plonk It · Bélgica', url: 'https://www.plonkit.net/belgium' }],
    verifiedAt: V,
  },
  {
    id: 'matricula-colombia-amarilla',
    name: 'Colombia: matrículas amarillas',
    category: 'matriculas',
    countries: ['co'],
    visual: 'Placas amarillas con texto negro, delante y detrás.',
    lookFor: 'El amarillo en América es raro: destaca al instante.',
    howToUse:
      'Ronda andina verde con placas amarillas → Colombia, no Ecuador ni Perú (placas blancas).',
    confidence: 'fuerte',
    confusions: [
      { countries: ['ec', 'pe'], distinction: 'Ecuador y Perú usan placas blancas en particulares.' },
    ],
    related: ['andes-verdes'],
    sources: [GH_PLATES],
    verifiedAt: V,
  },
  {
    id: 'matricula-mercosur',
    name: 'Placas Mercosur: banda azul superior',
    category: 'matriculas',
    countries: ['br', 'ar', 'uy'],
    visual:
      'Placa blanca con banda azul horizontal arriba (bandera + nombre del país), formato unificado desde 2018.',
    lookFor:
      'En Brasil conviven con las grises antiguas; en Argentina, con las negras viejas. La banda superior azul es lo común.',
    howToUse:
      'Confirma Cono Sur. Para separar Brasil de Argentina/Uruguay usa el idioma (ã/õ = Brasil).',
    confidence: 'moderada',
    related: ['portugues-tildes', 'pampa-uy-ar'],
    sources: [GH_PLATES],
    verifiedAt: V,
  },
  {
    id: 'matricula-malasia-indonesia',
    name: 'Placas negras en el Sudeste Asiático',
    category: 'matriculas',
    countries: ['my', 'id'],
    visual: 'Matrículas NEGRAS con caracteres blancos.',
    lookFor:
      'Malasia: negras siempre. Indonesia: históricamente negras, migrando a blancas desde 2022 — según el año de la imagen verás unas u otras.',
    howToUse:
      'Negras + "Jalan" → Malasia o Indonesia; separa por entorno (plantaciones ordenadas y más inglés → Malasia; densidad, warungs y motos → Indonesia).',
    confidence: 'moderada',
    exceptions: ['La transición indonesia a placas blancas hace esta pista dependiente de la fecha de cobertura.'],
    related: ['jalan-sudeste', 'indonesia-vs-malasia'],
    sources: [GH_PLATES],
    verifiedAt: V,
  },
  {
    id: 'matricula-india-comercial',
    name: 'India: blancas privadas, amarillas comerciales',
    category: 'matriculas',
    countries: ['in'],
    visual:
      'Vehículos privados con placa blanca; taxis, camiones y rickshaws con placa AMARILLA.',
    lookFor: 'La mezcla de ambas en el mismo tráfico es lo característico.',
    howToUse:
      'Tráfico denso con mezcla blanca/amarilla + camiones decorados → India.',
    confidence: 'moderada',
    related: ['rickshaws-por-pais', 'devanagari-vs-bengali'],
    sources: [GH_PLATES],
    verifiedAt: V,
  },
]
