import type { Clue } from '../types'

const V = '2026-10-12'

export const CLUES_MOBILIARIO: Clue[] = [
  {
    id: 'guardarrailes-tipos',
    name: 'Guardarraíles: metal, madera o cable',
    category: 'mobiliario',
    countries: ['se', 'at', 'ch', 'fr'],
    visual:
      'La barrera lateral de la carretera: perfil metálico en W (global), revestida de madera (zonas alpinas y escénicas), cables tensados (Suecia) u hormigón.',
    lookFor:
      'Tipo de barrera + forma de los postes que la sostienen + cómo termina (rematada hacia el suelo, en cola de pez, etc.).',
    howToUse:
      'La barrera de CABLES apoya Suecia con fuerza. La madera inclina a Alpes/escandinavia escénica. El detalle fino por país (perfil y postes) está en el Comparador visual: estudia ahí las fotos reales.',
    confidence: 'moderada',
    exceptions: ['El perfil en W es casi universal: solo discrimina por detalles de postes y remates.'],
    related: ['suecia-2mas1', 'bolardos-como-usarlos'],
    sources: [{ name: 'GeoHints · Guardrails', url: 'https://geohints.com/meta/guardrails' }],
    verifiedAt: V,
  },
  {
    id: 'hitos-kilometricos',
    name: 'Hitos kilométricos: el color de la red',
    category: 'mobiliario',
    countries: ['fr', 'es', 'pt'],
    visual:
      'Mojones bajos al borde de la vía con el número de kilómetro; muchos países los colorean según el tipo de carretera.',
    lookFor:
      'Francia: borne blanca con casquete ROJO en nacionales y AMARILLO en departamentales — te dice la letra de la carretera sin ver un cartel. España y Portugal usan hitos con el código de la vía (N-, A-).',
    why: 'Las redes viales nacionales/regionales se señalizan con códigos de color propios.',
    howToUse:
      'En Francia rural, el casquete del hito decide si buscas una D o una N en el mapa: acota muchísimo el pinpoint.',
    confidence: 'moderada',
    related: ['colores-carteles-autopista', 'bolardo-frances'],
    sources: [{ name: 'Geometas · Milestones', url: 'https://geometas.com/metas/categories/milestones/' }],
    verifiedAt: V,
  },
  {
    id: 'buzones-colores',
    name: 'Buzones: un color por país',
    category: 'mobiliario',
    countries: ['gb', 'fr', 'de', 'es', 'us', 'jp', 'nl'],
    visual: 'El buzón de correos público, con color corporativo nacional.',
    lookFor:
      'ROJO cilíndrico clásico → Reino Unido (y Japón, también cilíndrico rojo). AMARILLO → Francia, Alemania, España y gran parte de Europa. AZUL → Estados Unidos. NARANJA → Países Bajos.',
    howToUse:
      'Un buzón en la acera confirma país en un segundo, sobre todo el pilar rojo británico y el azul USPS.',
    confidence: 'moderada',
    confusions: [
      { countries: ['gb', 'jp'], distinction: 'Ambos rojos cilíndricos: decide con el idioma del cartel más cercano.' },
    ],
    related: ['uk-doble-amarilla-bordillo'],
    sources: [{ name: 'GeoHints · Post Boxes', url: 'https://geohints.com/meta/postBoxes' }],
    verifiedAt: V,
  },
  {
    id: 'semaforos-horizontales',
    name: 'Semáforos horizontales',
    category: 'mobiliario',
    countries: ['jp', 'kr'],
    visual: 'El cabezal del semáforo montado en HORIZONTAL sobre un brazo largo.',
    lookFor:
      'Horizontal con brazo largo → Japón y Corea del Sur (en Japón, en zonas de nieve pueden ser verticales). En América se ven ambos montajes según el estado/país.',
    howToUse:
      'Semáforo horizontal + Asia Oriental → separa Japón/Corea de Taiwán y Hong Kong (verticales); el alfabeto remata.',
    confidence: 'moderada',
    exceptions: ['Zonas nevadas de Japón usan semáforos verticales para que no acumulen nieve.'],
    related: ['japones-vs-coreano-vs-chino', 'postes-japon'],
    sources: [{ name: 'GeoHints · Traffic Lights', url: 'https://geohints.com/meta/trafficLights' }],
    verifiedAt: V,
  },
  {
    id: 'numeros-casa',
    name: 'Números de casa y placas de calle',
    category: 'mobiliario',
    countries: ['fr', 'it', 'cz'],
    visual:
      'La placa del número del portal: esmaltada azul con borde (Francia clásica), azulejos (Portugal/España), doble numeración roja y azul (Chequia).',
    lookFor:
      'Color, material y forma de la placa; en Chequia conviven número rojo (catastral) y azul (de calle): par delator.',
    howToUse:
      'Un portal en zoom puede confirmar país cuando no hay más texto. La doble placa roja+azul apunta a Chequia.',
    confidence: 'contextual',
    related: ['espana-vs-portugal-idioma', 'checo-vs-eslovaco'],
    sources: [{ name: 'GeoHints · House Numbers', url: 'https://geohints.com/meta/houseNumbers' }],
    verifiedAt: V,
  },
  {
    id: 'bordillos-pintados',
    name: 'Bordillos pintados a franjas',
    category: 'mobiliario',
    countries: ['ru', 'ua', 'tr', 'mx', 'pe'],
    visual: 'Bordillos de acera pintados en franjas blancas y negras (o rojas y blancas).',
    lookFor:
      'Franjas negro-blanco sistemáticas en cruces y medianas → espacio ex-soviético, Balcanes y Turquía; en Latinoamérica son frecuentes las amarillas o rojiblancas.',
    howToUse:
      'Refuerza región cuando no hay texto; nunca decide por sí solo.',
    confidence: 'contextual',
    related: ['bolardo-ruso', 'bloques-sovieticos'],
    sources: [{ name: 'GeoHints · Sidewalks', url: 'https://geohints.com/meta/sidewalks' }],
    verifiedAt: V,
  },
  {
    id: 'postes-nieve',
    name: 'Postes de nieve',
    category: 'mobiliario',
    countries: ['no', 'se', 'fi', 'is', 'ch', 'at'],
    visual:
      'Varas altas y flexibles (naranjas, amarillas o con banda reflectante) que marcan el borde de la vía cuando la nieve lo tapa.',
    lookFor: 'Su presencia en verano delata clima con nevadas fuertes; el color varía por país.',
    howToUse:
      'Verlas sitúa Nórdicos, Alpes, Islandia o alta montaña; combina con líneas e idioma para el país.',
    confidence: 'contextual',
    related: ['nordicos-linea-central', 'bolardos-nordicos'],
    sources: [{ name: 'GeoHints · Snow Poles', url: 'https://geohints.com/meta/snow' }],
    verifiedAt: V,
  },
  {
    id: 'gasolineras-marcas',
    name: 'Gasolineras: la marca delata el país',
    category: 'cultura',
    countries: ['mx', 'ar', 'br', 'cl', 'co', 'uy', 'id', 'my', 'th', 'in', 'nz'],
    visual: 'El rótulo de la estación de servicio, visible desde lejos.',
    lookFor:
      'Pemex → México. YPF → Argentina. Petrobras (BR) → Brasil. Copec → Chile. Terpel → Colombia. ANCAP → Uruguay. Pertamina → Indonesia. Petronas → Malasia. PTT → Tailandia. Indian Oil/HP → India. Z → Nueva Zelanda.',
    why: 'Las petroleras estatales o dominantes suelen operar en un solo país.',
    howToUse:
      'Una gasolinera de marca nacional cierra el país al instante; las globales (Shell, BP, Total) solo acotan región por idioma del cartel.',
    confidence: 'fuerte',
    exceptions: ['Petronas también tiene estaciones fuera de Malasia (poco frecuentes en cobertura).'],
    related: ['alto-vs-pare', 'jalan-sudeste'],
    sources: [{ name: 'GeoHints · Gas Stations', url: 'https://geohints.com/meta/companies/gasStations' }],
    verifiedAt: V,
  },
  {
    id: 'albania-bunkeres',
    name: 'Albania: búnkeres por todas partes',
    category: 'cultura',
    countries: ['al'],
    visual: 'Cúpulas de hormigón semienterradas (búnkeres de un solo tirador) en campos, playas y cunetas.',
    lookFor: 'La media esfera gris con ranura; hay cientos de miles repartidos por el país.',
    why: 'El régimen de Hoxha fortificó el país entero entre los 60 y los 80.',
    howToUse: 'Búnker-cúpula visto → Albania casi seguro; confirma con la ë final y Mercedes antiguos.',
    confidence: 'fuerte',
    related: ['cirilico-bulgaro-serbio'],
    sources: [{ name: 'Plonk It · Albania', url: 'https://www.plonkit.net/albania' }],
    verifiedAt: V,
  },
  {
    id: 'ruanda-orden',
    name: 'Ruanda: el país ordenado de las mil colinas',
    category: 'cultura',
    countries: ['rw'],
    visual:
      'Carreteras limpias y sin basura, cunetas de piedra labrada, moto-taxis donde conductor Y pasajero llevan casco.',
    lookFor: 'La limpieza sistemática y los dos cascos: rarísimos en la región.',
    why: 'Políticas nacionales estrictas (umuganda, prohibición de bolsas de plástico).',
    howToUse:
      'África Oriental verde y montañosa + orden impecable + conducción por la DERECHA → Ruanda, no Uganda (izquierda).',
    confidence: 'moderada',
    related: ['vecinos-sentido-opuesto', 'tierra-roja-tropical'],
    sources: [{ name: 'Plonk It · Ruanda', url: 'https://www.plonkit.net/rwanda' }],
    verifiedAt: V,
  },
  {
    id: 'senegal-sahel',
    name: 'Senegal: arena, baobabs y carros de caballo',
    category: 'cultura',
    countries: ['sn'],
    visual:
      'Calles de arena incluso en ciudades, baobabs enormes, carros tirados por caballo compartiendo la vía, carteles en francés.',
    lookFor: 'La combinación arena + caballo + francés es el sello senegalés.',
    howToUse:
      'África Occidental francófona con arena por suelo → Senegal como primera opción.',
    confidence: 'moderada',
    related: ['tierra-roja-tropical', 'hebreo-vs-arabe'],
    sources: [{ name: 'Plonk It · Senegal', url: 'https://www.plonkit.net/senegal' }],
    verifiedAt: V,
  },
  {
    id: 'montenegro-karst',
    name: 'Montenegro: montaña negra sobre el mar',
    category: 'paisaje',
    countries: ['me'],
    visual:
      'Paredes kársticas grises cayendo a bahías profundas; pueblos de piedra con teja; carreteras estrechas en balcón.',
    lookFor:
      'El contraste montaña dramática + Adriático; más abrupto que Croacia, más verde que Grecia.',
    howToUse:
      'Adriático con montaña encima → Montenegro frente a Croacia (costa más suave) ; cirílico ocasional lo separa de Croacia (solo latino).',
    confidence: 'contextual',
    related: ['cirilico-bulgaro-serbio', 'teja-arabe-mediterraneo'],
    sources: [{ name: 'Plonk It · Montenegro', url: 'https://www.plonkit.net/montenegro' }],
    verifiedAt: V,
  },
]
