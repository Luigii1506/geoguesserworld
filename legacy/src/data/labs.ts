import type { Lab } from './types'

export const LABS: Lab[] = [
  {
    id: 'lab-bolardos',
    title: 'Laboratorio de bolardos',
    icon: '🦺',
    intro:
      'Los bolardos deciden rondas europeas en segundos. Aquí estudias los diseños nacionales uno a uno y terminas con un drill de reconocimiento. Ten abierta la tabla visual de GeoHints (geohints.com/meta/bollards) mientras estudias: este laboratorio te da el QUÉ mirar; las fotos reales ponen la imagen.',
    items: [
      { country: 'fr', label: 'Francia', description: 'Blanco con franja roja reflectante en la parte alta.', distinguishing: 'El rojo va ARRIBA y el cuerpo es rectangular redondeado.' },
      { country: 'de', label: 'Alemania', description: 'Blanco con tope cortado en diagonal y banda negra con reflector.', distinguishing: 'El corte diagonal del tope es la firma germánica.' },
      { country: 'cz', label: 'Chequia/Eslovaquia', description: 'Blanco con banda reflectante naranja cerca del tope.', distinguishing: 'Naranja, no rojo: compáralo mentalmente con el francés.' },
      { country: 'pl', label: 'Polonia', description: 'Cuerpo aplanado tipo tabla con franja roja bajo el tope.', distinguishing: 'Más plano que el francés y la franja algo más baja.' },
      { country: 'es', label: 'España', description: 'Hito en cuña con cara inclinada hacia el tráfico y reflector cálido.', distinguishing: 'Toda la cara superior es una rampa, no un simple corte.' },
      { country: 'ru', label: 'Rusia', description: 'Franjas alternas negras y blancas, reflector rojo.', distinguishing: 'El patrón cebra completo no existe en Europa occidental.' },
      { country: 'au', label: 'Australia/NZ', description: 'Blanco con reflector rojo, a menudo plano tipo pala.', distinguishing: 'Si además se conduce por la izquierda, estás en Oceanía.' },
      { country: null, label: 'Método general', description: 'Forma → banda → reflectores → material, siempre en ese orden.', distinguishing: 'Dos bolardos consecutivos confirman que no miras una reposición suelta.' },
    ],
    drillQuestionIds: ['q-bolardo-1', 'q-bolardo-2', 'q-bolardo-3', 'q-bolardo-4'],
    relatedClues: ['bolardos-como-usarlos', 'bolardo-frances', 'bolardo-aleman-austriaco', 'bolardo-checo-eslovaco', 'bolardo-espanol', 'bolardo-ruso', 'bolardo-polaco'],
  },
  {
    id: 'lab-escrituras',
    title: 'Laboratorio de escrituras',
    icon: '🔤',
    intro:
      'Reconocer el sistema de escritura es la pista más fiable del juego. Entrena la silueta general de cada alfabeto: no necesitas leer, solo reconocer formas.',
    items: [
      { country: 'th', label: 'Tailandés', description: 'Trazos con circulitos de inicio, texto sin espacios.', distinguishing: 'Busca los círculos pequeños donde empieza cada letra.' },
      { country: 'kh', label: 'Jemer (Camboya)', description: 'Alto, picudo, con letras apiladas en racimos.', distinguishing: 'La más "ornamentada" del Sudeste Asiático.' },
      { country: 'la', label: 'Lao', description: 'Como el tailandés pero más redondo y limpio.', distinguishing: 'Menos circulitos, curvas más abiertas.' },
      { country: 'kr', label: 'Hangul (Corea)', description: 'Bloques silábicos con círculos y palos: 한국.', distinguishing: 'El círculo ㅇ aparece constantemente.' },
      { country: 'jp', label: 'Japonés', description: 'Kanji complejos mezclados con kana simples (の, し).', distinguishing: 'La MEZCLA de denso y simple es la firma; el chino es denso siempre.' },
      { country: 'ru', label: 'Cirílico ruso', description: 'И, Я, Ж, Ы en carteles.', distinguishing: 'La ы es rusa; і/ї son ucranianas; ъ frecuente es búlgaro.' },
      { country: 'gr', label: 'Griego', description: 'Σ, Δ, Λ, Ω mezcladas con letras "normales".', distinguishing: 'Si conduce por la izquierda con griego → Chipre.' },
      { country: 'il', label: 'Hebreo', description: 'Bloques cuadrados separados: א ב ש.', distinguishing: 'El árabe fluye enlazado; el hebreo va "a ladrillos".' },
      { country: 'in', label: 'Devanagari', description: 'Línea horizontal continua sobre las palabras.', distinguishing: 'El bengalí es anguloso sin esa línea tan sólida; el cingalés es todo curvas.' },
      { country: 'vn', label: 'Vietnamita', description: 'Latino con dos diacríticos apilados por vocal (ế, ộ).', distinguishing: 'Ninguna otra lengua apila tildes así.' },
      { country: 'ge', label: 'Georgiano', description: 'Letras redondas con colas, parecen anzuelos: ქართული.', distinguishing: 'El armenio es su pareja de confusión: más anguloso, con astas.' },
    ],
    drillQuestionIds: ['q-idioma-4', 'q-idioma-5', 'q-idioma-7', 'q-idioma-8', 'q-idioma-9', 'q-idioma-10', 'q-idioma-11', 'q-idioma-14'],
    relatedClues: ['tailandes-lao-jemer-birmano', 'japones-vs-coreano-vs-chino', 'cirilico-ruso-vs-ucraniano', 'hebreo-vs-arabe', 'devanagari-vs-bengali', 'vietnamita-diacriticos', 'georgiano-armenio'],
  },
  {
    id: 'lab-lineas',
    title: 'Laboratorio de líneas viales',
    icon: '🛣️',
    intro:
      'El color y patrón de las líneas es visible en el 95 % de las rondas. Este laboratorio fija las combinaciones que separan países vecinos.',
    items: [
      { country: 'us', label: 'América', description: 'Central amarilla, bordes blancos, en casi todo el continente.', distinguishing: 'No discrimina dentro de América: úsala para confirmar continente.' },
      { country: 'no', label: 'Noruega', description: 'Central amarilla en Europa nórdica.', distinguishing: 'Contra Suecia (blanca) es la pista decisiva.' },
      { country: 'is', label: 'Islandia', description: 'Central amarilla + paisaje volcánico sin árboles.', distinguishing: 'Contra Noruega: Islandia no tiene bosque.' },
      { country: 'fi', label: 'Finlandia', description: 'Blanca hoy; amarilla en cobertura antigua.', distinguishing: 'Fecha de la imagen importa: no descartes Finlandia por ver amarillo.' },
      { country: 'ie', label: 'Irlanda', description: 'Lateral amarilla DISCONTINUA, central blanca.', distinguishing: 'Contra UK: la lateral amarilla rural es irlandesa.' },
      { country: 'gb', label: 'Reino Unido', description: 'Dobles amarillas de aparcamiento junto al bordillo.', distinguishing: 'Son urbanas y pegadas a la acera, no líneas de tráfico.' },
      { country: 'se', label: 'Suecia', description: 'Todo blanco + carreteras 2+1 con barrera de cable.', distinguishing: 'La barrera de cable central es el extra sueco.' },
    ],
    drillQuestionIds: ['q-lineas-1', 'q-lineas-2', 'q-lineas-3'],
    relatedClues: ['linea-central-amarilla', 'nordicos-linea-central', 'irlanda-lateral-amarilla', 'uk-doble-amarilla-bordillo', 'suecia-2mas1'],
  },
  {
    id: 'lab-postes',
    title: 'Laboratorio de postes',
    icon: '⚡',
    intro:
      'Hay un poste en casi cada imagen. Material y silueta te dan continente; los diseños especiales te dan país. Compara con las fotos de GeoHints (geohints.com/meta/utilityPoles).',
    items: [
      { country: 'hu', label: 'Hungría', description: 'Hormigón con fila de agujeros pasantes.', distinguishing: 'El "poste escalera" es la joya de la categoría.' },
      { country: 'jp', label: 'Japón', description: 'Hormigón + transformadores cilíndricos + maraña ordenada.', distinguishing: 'Contra Corea: decide el alfabeto, no el poste.' },
      { country: 'us', label: 'Norteamérica', description: 'Madera alta con travesaño y transformador de cuba.', distinguishing: 'La madera sin pintar domina el continente.' },
      { country: 'ru', label: 'Ex-URSS', description: 'Hormigón con tirante diagonal formando "A".', distinguishing: 'El tirante diagonal es la silueta soviética.' },
      { country: 'th', label: 'Tailandia', description: 'Hormigón de sección CUADRADA con marañas de cable.', distinguishing: 'La sección cuadrada separa de Vietnam (redonda con cruceta).' },
      { country: null, label: 'Método', description: 'Material → tope → travesaños → aisladores.', distinguishing: 'Postes de línea eléctrica mayor no cuentan: mira los de distribución local.' },
    ],
    drillQuestionIds: ['q-poste-1', 'q-poste-2', 'q-poste-3'],
    relatedClues: ['postes-como-pista', 'postes-hungria', 'postes-japon', 'postes-madera-usa', 'postes-exsovieticos', 'postes-tropicos-hormigon'],
  },
  {
    id: 'lab-coche',
    title: 'Laboratorio del coche de Google',
    icon: '📷',
    intro:
      'Mirar hacia abajo cuesta un segundo y a veces regala el país entero. Generaciones de cámara y vehículos especiales, con la advertencia de siempre: este meta caduca con cada actualización de cobertura.',
    items: [
      { country: null, label: 'Gen 2', description: 'Imagen mediocre, bordes borrosos, cobertura vieja.', distinguishing: 'Si la calidad es mala en un país rico: cobertura antigua.' },
      { country: null, label: 'Gen 3', description: 'Nítida, colores suaves, halo frecuente alrededor del sol.', distinguishing: 'El halo solar es el delator de Gen 3.' },
      { country: null, label: 'Gen 4', description: 'HDR vívido, contraste alto, azul de cielo intenso.', distinguishing: 'La saturación "de postal" marca Gen 4.' },
      { country: 'ke', label: 'Kenia', description: 'Snorkel visible en el frontal del 4x4.', distinguishing: 'África Oriental + snorkel = Kenia.' },
      { country: 'ng', label: 'Nigeria', description: 'Vehículo de escolta persistente en toda la ronda.', distinguishing: 'Si el mismo coche te sigue siempre, no es casualidad.' },
      { country: 'mg', label: 'Madagascar', description: 'Caja de pickup visible al mirar abajo.', distinguishing: 'Altura de cámara rara + caja = Madagascar.' },
      { country: 'gh', label: 'Ghana', description: 'Resto de cinta/carrocería negra en una esquina del coche.', distinguishing: 'Detalle fino: verifícalo en tus partidas antes de fiarte.' },
    ],
    drillQuestionIds: ['q-meta-1', 'q-meta-2', 'q-meta-4', 'q-meta-5'],
    relatedClues: ['generaciones-camara', 'kenia-snorkel', 'nigeria-escolta', 'madagascar-pickup', 'ghana-cinta', 'alemania-cobertura'],
  },
  {
    id: 'lab-sentido',
    title: 'Laboratorio del sentido de circulación',
    icon: '↔️',
    intro:
      'La primera decisión de toda ronda: ¿izquierda o derecha? Memoriza los bloques y las fronteras donde cambia.',
    items: [
      { country: 'gb', label: 'Europa izquierda', description: 'Reino Unido, Irlanda, Malta, Chipre. Nada más.', distinguishing: 'Griego + izquierda = Chipre, nunca Grecia.' },
      { country: 'jp', label: 'Asia izquierda', description: 'Japón, Tailandia, Malasia, Singapur, Indonesia, India, Sri Lanka, Bangladés, Nepal, Bután, Hong Kong.', distinguishing: 'Vietnam, Camboya, Laos, Filipinas, Corea y Taiwán van por la DERECHA.' },
      { country: 'za', label: 'África izquierda', description: 'Sudáfrica, Lesoto, Esuatini, Botsuana, Kenia, Uganda y vecinos del este/sur.', distinguishing: 'África Occidental (Ghana, Nigeria, Senegal) va por la derecha.' },
      { country: 'au', label: 'Oceanía', description: 'Australia y Nueva Zelanda, ambas por la izquierda.', distinguishing: 'Oceanía entera es zurda: no pierdas tiempo ahí.' },
      { country: null, label: 'Detección sin tráfico', description: 'Señales de frente, coches aparcados, flechas de carril, paradas de bus.', distinguishing: 'Confirma con DOS indicios: uno solo puede engañar.' },
    ],
    drillQuestionIds: ['q-circ-1', 'q-circ-2', 'q-circ-3', 'q-matricula-4'],
    relatedClues: ['izquierda-mundo', 'detectar-sentido', 'vecinos-sentido-opuesto'],
  },
]

export const LAB_MAP = new Map(LABS.map((l) => [l.id, l]))
