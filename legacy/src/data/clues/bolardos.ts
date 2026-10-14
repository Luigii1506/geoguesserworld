import type { Clue } from '../types'

const V = '2026-10-11'
const GH_BOLLARDS = { name: 'GeoHints · Bollards', url: 'https://geohints.com/meta/bollards' }
const GM_BOLLARDS = { name: 'Geometas · Bollards', url: 'https://geometas.com/metas/categories/bollards/' }

export const CLUES_BOLARDOS: Clue[] = [
  {
    id: 'bolardos-como-usarlos',
    name: 'Bolardos: el separador más rápido de Europa',
    category: 'bolardos',
    countries: [],
    visual:
      'Postes bajos (60-120 cm) al borde de la carretera con reflectores, cada 25-50 m en curvas y tramos rurales.',
    lookFor:
      'Cuatro rasgos en orden: (1) forma del cuerpo (redondo, plano, en cuña), (2) color y posición de la banda, (3) color del reflector delantero Y trasero, (4) material (plástico, hormigón, madera).',
    why:
      'Cada país normaliza su delineador vial; la norma cambia poco y es visible desde lejos: por eso es una de las pistas más rentables.',
    howToUse:
      'Si dudas entre 2-3 países europeos, acércate a un bolardo antes que a una señal: suele decidir. Memoriza primero los de países grandes (Francia, Alemania, Polonia, Chequia, España).',
    confidence: 'fuerte',
    related: ['bolardo-frances', 'bolardo-aleman-austriaco', 'bolardo-checo-eslovaco', 'bolardo-espanol'],
    sources: [GH_BOLLARDS, GM_BOLLARDS],
    verifiedAt: V,
  },
  {
    id: 'bolardo-frances',
    name: 'Bolardo francés: banda roja alta',
    category: 'bolardos',
    countries: ['fr'],
    visual:
      'Poste blanco con una franja ROJA reflectante cerca de la parte superior; cuerpo rectangular redondeado.',
    lookFor:
      'La banda roja ocupa la parte alta del poste. En autovías puede variar el soporte, pero el patrón blanco+rojo se mantiene.',
    howToUse:
      'Blanco con banda roja arriba en un paisaje templado europeo → Francia como primera hipótesis; confirma con "Rue/Route D-" o matrícula.',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['es', 'it'],
        distinction:
          'España usa un hito en cuña con reflector naranja/amarillo; Italia usa menos bolardos y de diseño distinto. La banda roja limpia y alta es francesa.',
      },
    ],
    related: ['bolardos-como-usarlos', 'bolardo-espanol'],
    sources: [GH_BOLLARDS, { name: 'Plonk It · Francia', url: 'https://www.plonkit.net/france' }],
    verifiedAt: V,
  },
  {
    id: 'bolardo-aleman-austriaco',
    name: 'Bolardo alemán/austriaco: tope inclinado y banda negra',
    category: 'bolardos',
    countries: ['de', 'at'],
    visual:
      'Poste blanco de plástico con la cara superior CORTADA EN DIAGONAL y una zona negra con reflector orientada al tráfico.',
    lookFor:
      'El corte diagonal del tope es la firma. La banda/trapecio negro lleva el reflector.',
    why: 'El "Leitpfosten" alemán es norma industrial (y países vecinos adoptaron variantes).',
    howToUse:
      'Tope diagonal + banda negra → espacio germánico. Entre Alemania y Austria, decide con otra pista (cobertura antigua borrosa → Alemania; Alpes constantes → Austria).',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['si', 'ch'],
        distinction:
          'Países vecinos usan diseños parecidos; la diferencia exacta de reflectores conviene verificarla en GeoHints antes de apostar fino.',
      },
    ],
    exceptions: ['La distinción fina Alemania vs Austria por el bolardo requiere verificación propia: no apuestes solo por esto.'],
    related: ['bolardos-como-usarlos', 'alemania-cobertura'],
    sources: [GH_BOLLARDS, GM_BOLLARDS],
    verifiedAt: V,
  },
  {
    id: 'bolardo-checo-eslovaco',
    name: 'Bolardo checo/eslovaco: banda naranja',
    category: 'bolardos',
    countries: ['cz', 'sk'],
    visual:
      'Poste blanco con banda reflectante NARANJA cerca del tope.',
    lookFor:
      'El naranja (no rojo) de la banda es lo que separa de Francia.',
    howToUse:
      'Banda naranja en Europa Central → Chequia o Eslovaquia; decide entre ambas con el idioma (ř/ů = checo; ľ/ô = eslovaco) o el relieve (Tatras = Eslovaquia).',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['fr'],
        distinction: 'Francia usa banda roja; el naranja checo es claramente más anaranjado.',
      },
    ],
    related: ['checo-vs-eslovaco', 'bolardos-como-usarlos'],
    sources: [GH_BOLLARDS, { name: 'Plonk It · Chequia', url: 'https://www.plonkit.net/czechia' }],
    verifiedAt: V,
  },
  {
    id: 'bolardo-espanol',
    name: 'Hito español en cuña',
    category: 'bolardos',
    countries: ['es'],
    visual:
      'Poste blanco con el tope en forma de CUÑA (cara inclinada hacia el tráfico) y reflector naranja/amarillo en esa cara.',
    lookFor:
      'La cara inclinada completa (no solo un corte) orientada al conductor, con reflector de tono cálido.',
    howToUse:
      'Paisaje seco mediterráneo + hito en cuña → España; confirma con "Calle/Avda." o señal A-/N-.',
    confidence: 'fuerte',
    confusions: [
      {
        countries: ['pt'],
        distinction:
          'Portugal usa delineadores distintos; si ves azulejos, calzada de adoquín o "Rua", cruza a Portugal.',
      },
    ],
    related: ['bolardos-como-usarlos', 'espana-vs-portugal-idioma'],
    sources: [GM_BOLLARDS, { name: 'Geometas · España', url: 'https://geometas.com/metas/countries/spain/' }],
    verifiedAt: V,
  },
  {
    id: 'bolardo-ruso',
    name: 'Delineador ruso a franjas negras y blancas',
    category: 'bolardos',
    countries: ['ru'],
    visual:
      'Poste con franjas alternas negras y blancas, a menudo con reflector rojo.',
    lookFor:
      'El patrón cebra vertical; también aparece en postes de curva y mojones.',
    howToUse:
      'Franjas negro-blanco + cirílico → Rusia (otros países ex-soviéticos usan variantes similares: confirma con idioma).',
    confidence: 'moderada',
    confusions: [
      {
        countries: ['ua', 'kz'],
        distinction:
          'Ucrania y Kazajistán tienen delineadores parecidos: decide con і/ї (ucraniano) o letras kazajas (ә, қ, ң).',
      },
    ],
    related: ['cirilico-ruso-vs-ucraniano', 'cirilico-kazajo'],
    sources: [GH_BOLLARDS],
    verifiedAt: V,
  },
  {
    id: 'bolardo-polaco',
    name: 'Bolardo polaco con franja roja',
    category: 'bolardos',
    countries: ['pl'],
    visual:
      'Poste blanco aplanado con franja reflectante roja bajo el tope.',
    lookFor:
      'Cuerpo más plano (tipo tabla) que el francés; la franja roja va algo más baja.',
    howToUse:
      'En Europa Central con señales de advertencia amarillas, el bolardo ayuda a fijar Polonia frente a Chequia (naranja).',
    confidence: 'moderada',
    exceptions: ['Variantes regionales existen; verifica en GeoHints si vas a apostar solo por el bolardo.'],
    related: ['bolardo-checo-eslovaco', 'polaco-letra-l'],
    sources: [GH_BOLLARDS, { name: 'Plonk It · Polonia', url: 'https://www.plonkit.net/poland' }],
    verifiedAt: V,
  },
  {
    id: 'bolardos-nordicos',
    name: 'Bolardos nórdicos: plástico flexible',
    category: 'bolardos',
    countries: ['se', 'no', 'fi'],
    visual:
      'Postes de plástico flexible, altos y finos, pensados para quitanieves; reflectores amplios.',
    lookFor:
      'La silueta fina y flexible (a veces doblada) delata el clima de nieve; el color exacto por país conviene verificarlo.',
    howToUse:
      'Te sitúa en zona de nieve (Nórdicos, Báltico, alta montaña). Para decidir el país usa líneas y letras, no el bolardo.',
    confidence: 'contextual',
    exceptions: ['La asignación fina por país (tono, forma del reflector) está pendiente de verificación propia.'],
    related: ['nordicos-linea-central'],
    sources: [GH_BOLLARDS],
    verifiedAt: V,
  },
  {
    id: 'bolardo-australia-nz',
    name: 'Delineadores de Australia y Nueva Zelanda',
    category: 'bolardos',
    countries: ['au', 'nz'],
    visual:
      'Postes blancos (madera o plástico) con reflector rojo hacia el tráfico; en Australia a menudo planos tipo tabla.',
    lookFor:
      'Blanco + reflector rojo + conducción por la izquierda.',
    howToUse:
      'Confirma Oceanía; para separar AU de NZ usa vegetación (eucalipto vs helecho/verde intenso) y topónimos maoríes.',
    confidence: 'moderada',
    related: ['eucaliptos-australia', 'maori-toponimos'],
    sources: [GH_BOLLARDS],
    verifiedAt: V,
  },
]
