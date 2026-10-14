import type { Question } from './types'

// Banco de preguntas de autor. Cada explicación dice por qué la opción
// correcta es válida Y por qué las alternativas son menos probables.

export const QUESTIONS: Question[] = [
  // ── Líneas viales ──
  {
    id: 'q-lineas-1', type: 'pista', category: 'lineas-viales', difficulty: 1,
    prompt: 'Estás en Europa y la línea central de la carretera es amarilla. ¿Qué países siguen en juego?',
    options: ['Noruega e Islandia (y Finlandia antigua)', 'Suecia y Dinamarca', 'Alemania y Polonia', 'Cualquier país europeo'],
    answer: 0,
    explanation:
      'Solo Noruega e Islandia mantienen la central amarilla en Europa (y la cobertura vieja de Finlandia). Suecia, Dinamarca, Alemania y Polonia pintan la central de blanco, como casi todo el continente.',
    relatedClues: ['linea-central-amarilla', 'nordicos-linea-central'],
  },
  {
    id: 'q-lineas-2', type: 'duelo', category: 'lineas-viales', difficulty: 2,
    prompt: 'Paisaje nórdico, central blanca y una barrera de cables de acero separando un tramo 2+1. ¿Primera hipótesis?',
    options: ['Suecia', 'Noruega', 'Islandia', 'Rusia'],
    answer: 0,
    explanation:
      'Las carreteras 2+1 con barrera de cable son un despliegue masivo sueco. Noruega e Islandia quedan además debilitadas por la central blanca (ambas usan amarilla); Rusia no cuida así sus secundarias.',
    relatedClues: ['suecia-2mas1', 'nordicos-linea-central'],
  },
  {
    id: 'q-lineas-3', type: 'pista', category: 'lineas-viales', difficulty: 2,
    prompt: 'Ves una línea lateral AMARILLA discontinua en el borde y central blanca. ¿Dónde estás?',
    options: ['Irlanda', 'Reino Unido', 'Francia', 'Países Bajos'],
    answer: 0,
    explanation:
      'La lateral amarilla discontinua es el patrón irlandés. En Reino Unido el amarillo del borde son las dobles líneas de prohibido aparcar junto al bordillo urbano, no la lateral rural; Francia y Países Bajos bordean en blanco.',
    relatedClues: ['irlanda-lateral-amarilla', 'uk-doble-amarilla-bordillo'],
  },

  // ── Bolardos ──
  {
    id: 'q-bolardo-1', type: 'pista', category: 'bolardos', difficulty: 1,
    prompt: 'Bolardo blanco con franja ROJA reflectante cerca del tope. ¿País más probable?',
    options: ['Francia', 'Chequia', 'Alemania', 'España'],
    answer: 0,
    explanation:
      'La banda roja alta sobre poste blanco es el clásico francés. Chequia usa banda NARANJA, Alemania un tope inclinado con banda negra, y España un hito en cuña con reflector cálido.',
    relatedClues: ['bolardo-frances'],
  },
  {
    id: 'q-bolardo-2', type: 'duelo', category: 'bolardos', difficulty: 2,
    prompt: 'Bolardo blanco con banda NARANJA y un cartel cercano con la letra "ř". ¿País?',
    options: ['Chequia', 'Eslovaquia', 'Polonia', 'Hungría'],
    answer: 0,
    explanation:
      'La banda naranja reduce a Chequia/Eslovaquia, y la ř es EXCLUSIVA del checo (el eslovaco usa ľ, ô). Polonia lleva franja roja en bolardo plano y Hungría no encaja con la ř.',
    relatedClues: ['bolardo-checo-eslovaco', 'checo-vs-eslovaco'],
  },
  {
    id: 'q-bolardo-3', type: 'pista', category: 'bolardos', difficulty: 2,
    prompt: 'Delineador con franjas negras y blancas alternas y un cartel en cirílico con "ы". ¿País?',
    options: ['Rusia', 'Ucrania', 'Bulgaria', 'Serbia'],
    answer: 0,
    explanation:
      'El delineador cebra es característico ruso y la ы no existe en ucraniano (que usa і/ї). Bulgaria y Serbia tienen cirílico pero estética mediterránea/balcánica y otros delineadores.',
    relatedClues: ['bolardo-ruso', 'cirilico-ruso-vs-ucraniano'],
  },
  {
    id: 'q-bolardo-4', type: 'pista', category: 'bolardos', difficulty: 1,
    prompt: '¿Cuál es el orden correcto para "leer" un bolardo desconocido?',
    options: [
      'Forma del cuerpo → color de banda → reflectores → material',
      'Altura → sombra → distancia entre bolardos',
      'Solo importa el color del reflector trasero',
      'Los bolardos no son fiables, mejor ignorarlos',
    ],
    answer: 0,
    explanation:
      'Forma, banda, reflector y material es la secuencia que distingue diseños nacionales. La altura y separación varían dentro del mismo país, y los bolardos son de las pistas MÁS fiables de Europa, no al revés.',
    relatedClues: ['bolardos-como-usarlos'],
  },

  // ── Señales ──
  {
    id: 'q-senal-1', type: 'duelo', category: 'senales', difficulty: 1,
    prompt: 'Ronda nórdica: la señal de advertencia tiene fondo BLANCO. ¿Qué país acaba de ganar puntos?',
    options: ['Dinamarca', 'Suecia', 'Finlandia', 'Islandia'],
    answer: 0,
    explanation:
      'Dinamarca es el nórdico de advertencias blancas; Suecia, Finlandia, Noruega e Islandia usan fondo amarillo. Combínalo con "vej" y el terreno llano agrícola.',
    relatedClues: ['advertencia-amarilla-nordica'],
  },
  {
    id: 'q-senal-2', type: 'pista', category: 'senales', difficulty: 1,
    prompt: 'La señal de stop es un TRIÁNGULO rojo invertido. ¿Dónde estás?',
    options: ['Japón', 'Corea del Sur', 'Taiwán', 'Tailandia'],
    answer: 0,
    explanation:
      'Japón es el único país jugable con stop triangular invertido (止まれ). Corea, Taiwán y Tailandia usan el octógono rojo estándar.',
    relatedClues: ['stop-japon-triangulo'],
  },
  {
    id: 'q-senal-3', type: 'duelo', category: 'senales', difficulty: 1,
    prompt: 'Octógono rojo con la palabra "ALTO". ¿Región?',
    options: ['México y Centroamérica', 'Sudamérica', 'España', 'Filipinas'],
    answer: 0,
    explanation:
      '"ALTO" es el stop de México y Centroamérica. Sudamérica usa "PARE" (también Brasil en portugués), España usa "STOP" y Filipinas "STOP" en inglés.',
    relatedClues: ['alto-vs-pare'],
  },
  {
    id: 'q-senal-4', type: 'pista', category: 'senales', difficulty: 2,
    prompt: 'Carteles direccionales VERDES en autopista y azules en carretera normal. ¿Qué par de países encaja?',
    options: ['Italia y Suiza', 'Francia y España', 'Alemania y Austria', 'Reino Unido y Países Bajos'],
    answer: 0,
    explanation:
      'Italia y Suiza invierten el esquema: verde = autopista. Francia, España, Alemania y Austria usan azul para autopista. En UK el azul es motorway pero el verde es vía primaria, no el par descrito.',
    relatedClues: ['colores-carteles-autopista'],
  },
  {
    id: 'q-senal-5', type: 'descarte', category: 'senales', difficulty: 1,
    prompt: 'Ves señales de advertencia en ROMBO amarillo. ¿Qué puedes descartar casi por completo?',
    options: ['Europa continental', 'Sudamérica', 'Australia', 'Japón'],
    answer: 0,
    explanation:
      'El rombo amarillo es el estándar de América, Oceanía y gran parte de Asia-Pacífico, e Irlanda es la única excepción europea. Europa continental usa triángulos con borde rojo.',
    relatedClues: ['advertencia-rombo-amarillo'],
  },
  {
    id: 'q-senal-6', type: 'combinada', category: 'senales', difficulty: 2,
    prompt: 'Octógono "ARRÊT" + línea central amarilla + postes de madera. ¿Dónde?',
    options: ['Quebec (Canadá)', 'Francia', 'Bélgica (Valonia)', 'Suiza francófona'],
    answer: 0,
    explanation:
      'El francés sitúa cuatro candidatos, pero la central amarilla y los postes de madera son norteamericanos: solo Quebec reúne las tres. Francia/Bélgica/Suiza pintan la central blanca y usan otros postes.',
    relatedClues: ['arret-quebec', 'linea-central-amarilla', 'postes-madera-usa'],
  },

  // ── Matrículas ──
  {
    id: 'q-matricula-1', type: 'pista', category: 'matriculas', difficulty: 1,
    prompt: 'Todos los coches llevan matrícula amarilla delante Y detrás. Estás en Europa continental. ¿País?',
    options: ['Países Bajos', 'Reino Unido', 'Luxemburgo', 'Francia'],
    answer: 0,
    explanation:
      'Ambas placas amarillas = Países Bajos. Reino Unido solo la trasera (y no es continental), Luxemburgo solo la trasera, Francia las lleva blancas.',
    relatedClues: ['matricula-nl-amarilla'],
  },
  {
    id: 'q-matricula-2', type: 'pista', category: 'matriculas', difficulty: 2,
    prompt: 'Matrícula europea blanca con caracteres ROJIZOS. ¿País?',
    options: ['Bélgica', 'Países Bajos', 'Dinamarca', 'Suiza'],
    answer: 0,
    explanation:
      'Bélgica es el único país europeo con caracteres rojos en placa blanca. Países Bajos usa placas amarillas, Dinamarca y Suiza caracteres negros.',
    relatedClues: ['matricula-be-roja'],
  },
  {
    id: 'q-matricula-3', type: 'duelo', category: 'matriculas', difficulty: 1,
    prompt: 'Montaña verde andina y los coches llevan placas AMARILLAS. ¿País?',
    options: ['Colombia', 'Ecuador', 'Perú', 'Venezuela'],
    answer: 0,
    explanation:
      'Colombia es el país andino de placas amarillas en particulares. Ecuador y Perú las usan blancas; Venezuela ni siquiera tiene cobertura oficial de Street View.',
    relatedClues: ['matricula-colombia-amarilla', 'paises-sin-cobertura'],
  },
  {
    id: 'q-matricula-4', type: 'pista', category: 'matriculas', difficulty: 2,
    prompt: 'Sudeste asiático, conducción izquierda, matrículas NEGRAS en todos los coches. ¿Qué par queda en juego?',
    options: ['Malasia e Indonesia', 'Tailandia y Laos', 'Vietnam y Camboya', 'Filipinas y Singapur'],
    answer: 0,
    explanation:
      'Placas negras + izquierda = Malasia o Indonesia (en imágenes antiguas). Tailandia conduce por la izquierda pero usa placas blancas; Vietnam, Camboya y Filipinas conducen por la derecha.',
    relatedClues: ['matricula-malasia-indonesia', 'izquierda-mundo'],
  },

  // ── Circulación ──
  {
    id: 'q-circ-1', type: 'descarte', category: 'circulacion', difficulty: 1,
    prompt: 'El tráfico va por la IZQUIERDA. ¿Cuál de estos países queda DESCARTADO?',
    options: ['Camboya', 'Tailandia', 'Kenia', 'Japón'],
    answer: 0,
    explanation:
      'Camboya conduce por la derecha (herencia francesa). Tailandia, Kenia y Japón son países de conducción por la izquierda.',
    relatedClues: ['vecinos-sentido-opuesto', 'izquierda-mundo'],
  },
  {
    id: 'q-circ-2', type: 'pista', category: 'circulacion', difficulty: 2,
    prompt: 'Carretera vacía sin tráfico: ¿cuál es la forma MÁS fiable de deducir el sentido de circulación?',
    options: [
      'Dos indicios independientes: señales de frente + coches aparcados',
      'El lado donde está el arcén más ancho',
      'La posición del sol',
      'El color de la línea central',
    ],
    answer: 0,
    explanation:
      'Las señales legibles de frente y la orientación de los aparcados son indicios directos; cruzar dos evita errores por un coche mal estacionado. Arcén, sol y color de línea no dicen nada del sentido.',
    relatedClues: ['detectar-sentido'],
  },
  {
    id: 'q-circ-3', type: 'duelo', category: 'circulacion', difficulty: 2,
    prompt: 'África subsahariana anglófona, tráfico por la DERECHA. ¿Qué país encaja?',
    options: ['Ghana', 'Kenia', 'Uganda', 'Sudáfrica'],
    answer: 0,
    explanation:
      'África Occidental (Ghana, Nigeria) conduce por la derecha; la oriental y austral (Kenia, Uganda, Sudáfrica) por la izquierda. Es el gran divisor del continente jugable.',
    relatedClues: ['izquierda-mundo', 'vecinos-sentido-opuesto'],
  },

  // ── Postes ──
  {
    id: 'q-poste-1', type: 'pista', category: 'postes', difficulty: 1,
    prompt: 'Postes de hormigón con una fila de AGUJEROS a lo largo. ¿País?',
    options: ['Hungría', 'Polonia', 'Rumanía', 'Alemania'],
    answer: 0,
    explanation:
      'El poste perforado "de escalera" es el clásico húngaro. Polonia y Alemania usan sobre todo hormigón macizo o madera; Rumanía hormigón sin esa fila de huecos característica.',
    relatedClues: ['postes-hungria'],
  },
  {
    id: 'q-poste-2', type: 'duelo', category: 'postes', difficulty: 2,
    prompt: 'Ciudad asiática con marañas de cables y transformadores CILÍNDRICOS en los postes. El cartel está en bloques silábicos con círculos. ¿País?',
    options: ['Corea del Sur', 'Japón', 'Taiwán', 'Vietnam'],
    answer: 0,
    explanation:
      'Los bloques con círculos son hangul → Corea. Japón tiene postes parecidos pero escribe con kanji/kana; Taiwán usa chino tradicional y Vietnam alfabeto latino con diacríticos.',
    relatedClues: ['postes-japon', 'japones-vs-coreano-vs-chino'],
  },
  {
    id: 'q-poste-3', type: 'pista', category: 'postes', difficulty: 2,
    prompt: 'Poste de hormigón apoyado por otro poste DIAGONAL formando una "A" abierta. ¿Región?',
    options: ['Espacio ex-soviético', 'Escandinavia', 'Norteamérica', 'Australia'],
    answer: 0,
    explanation:
      'El tirante diagonal de hormigón es típico de Rusia, Ucrania y Asia Central. Escandinavia y Norteamérica usan madera; Australia madera o metal sin ese tirante.',
    relatedClues: ['postes-exsovieticos'],
  },

  // ── Idioma ──
  {
    id: 'q-idioma-1', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: 'Un cartel dice "Jūrmalas iela". ¿País?',
    options: ['Letonia', 'Lituania', 'Estonia', 'Polonia'],
    answer: 0,
    explanation:
      'Los macrones (ū, ā) y la palabra "iela" (calle) son letones. Lituania usa "gatvė", Estonia "tänav" y Polonia "ul." con ł/ą.',
    relatedClues: ['letonia-macrones', 'iela-baltico'],
  },
  {
    id: 'q-idioma-2', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: 'Ves la letra "ř" en un cartel. ¿Qué país es, sin más pistas?',
    options: ['Chequia', 'Eslovaquia', 'Polonia', 'Eslovenia'],
    answer: 0,
    explanation:
      'La ř solo existe en checo. El eslovaco usa ľ/ô, el polaco rz (dos letras) y el esloveno solo č/š/ž.',
    relatedClues: ['checo-vs-eslovaco'],
  },
  {
    id: 'q-idioma-3', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: '"Győr 12 km" en un cartel. ¿Qué delata la ő?',
    options: ['Húngaro', 'Turco', 'Rumano', 'Checo'],
    answer: 0,
    explanation:
      'El doble acento agudo (ő, ű) es exclusivo del húngaro. El turco usa ö simple, el rumano ă/ș/ț y el checo ů/ř.',
    relatedClues: ['hungaro-doble-acento'],
  },
  {
    id: 'q-idioma-4', type: 'duelo', category: 'idioma', difficulty: 2,
    prompt: 'Cartel en cirílico que incluye la letra "ї". ¿País?',
    options: ['Ucrania', 'Rusia', 'Bulgaria', 'Kazajistán'],
    answer: 0,
    explanation:
      'La ї (i con diéresis) es ucraniana. El ruso usa ы/ё, el búlgaro abusa de ъ y el kazajo añade ә/қ/ң.',
    relatedClues: ['cirilico-ruso-vs-ucraniano'],
  },
  {
    id: 'q-idioma-5', type: 'pista', category: 'idioma', difficulty: 2,
    prompt: 'Cirílico con letras "ә", "қ" y "ң". ¿Dónde estás?',
    options: ['Kazajistán', 'Rusia', 'Mongolia', 'Serbia'],
    answer: 0,
    explanation:
      'Esas letras extra son del kazajo. Mongolia añade solo ө/ү, Rusia ninguna de ellas y Serbia usa ћ/ђ/џ.',
    relatedClues: ['cirilico-kazajo'],
  },
  {
    id: 'q-idioma-6', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: 'Palabra con "ã" en un cartel americano. ¿País?',
    options: ['Brasil', 'Argentina', 'México', 'Colombia'],
    answer: 0,
    explanation:
      'La tilde nasal ã es portuguesa: en América, Brasil. Argentina, México y Colombia escriben en español, sin ã.',
    relatedClues: ['portugues-tildes'],
  },
  {
    id: 'q-idioma-7', type: 'duelo', category: 'idioma', difficulty: 2,
    prompt: 'Escritura del Sudeste Asiático con picos altos y letras apiladas, muy ornamentada. El tráfico va por la derecha. ¿País?',
    options: ['Camboya', 'Tailandia', 'Laos', 'Birmania'],
    answer: 0,
    explanation:
      'La escritura jemer es la más picuda y apilada; Camboya además conduce por la derecha. Tailandia (circulitos) va por la izquierda; el lao es redondeado; el birmano son círculos completos.',
    relatedClues: ['tailandes-lao-jemer-birmano', 'vecinos-sentido-opuesto'],
  },
  {
    id: 'q-idioma-8', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: 'Letrero con "ế" y "ộ" (diacríticos apilados). ¿País?',
    options: ['Vietnam', 'Tailandia', 'Filipinas', 'Indonesia'],
    answer: 0,
    explanation:
      'Solo el vietnamita apila dos diacríticos por vocal sobre alfabeto latino. Tailandia no usa latino; filipino e indonesio no llevan diacríticos.',
    relatedClues: ['vietnamita-diacriticos'],
  },
  {
    id: 'q-idioma-9', type: 'duelo', category: 'idioma', difficulty: 2,
    prompt: 'Caracteres asiáticos SIN sílabas simples ni círculos, todo denso. Conducción por la izquierda. ¿Dónde?',
    options: ['Hong Kong', 'Japón', 'Corea del Sur', 'Taiwán'],
    answer: 0,
    explanation:
      'Chino puro (sin kana ni hangul) reduce a Taiwán/Hong Kong; la conducción izquierda elige Hong Kong. Japón mezclaría kana; Corea mostraría círculos hangul; Taiwán conduce por la derecha.',
    relatedClues: ['japones-vs-coreano-vs-chino', 'izquierda-mundo'],
  },
  {
    id: 'q-idioma-10', type: 'pista', category: 'idioma', difficulty: 2,
    prompt: 'Alfabeto de letras redondas con colas, parecen anzuelos y uvas. ¿Qué país?',
    options: ['Georgia', 'Armenia', 'Grecia', 'Israel'],
    answer: 0,
    explanation:
      'El georgiano es redondo y fluido; el armenio es anguloso con astas; el griego y el hebreo tienen formas bien distintas (Σ/Δ y bloques cuadrados).',
    relatedClues: ['georgiano-armenio'],
  },
  {
    id: 'q-idioma-11', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: 'Letras CUADRADAS separadas, sin ligaduras, leyéndose de derecha a izquierda. ¿Qué escritura es?',
    options: ['Hebreo', 'Árabe', 'Tailandés', 'Georgiano'],
    answer: 0,
    explanation:
      'El hebreo parece bloques independientes; el árabe es cursivo y enlazado. Tailandés y georgiano se leen de izquierda a derecha.',
    relatedClues: ['hebreo-vs-arabe'],
  },
  {
    id: 'q-idioma-12', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: 'Topónimo con "þ" (thorn). ¿País?',
    options: ['Islandia', 'Noruega', 'Dinamarca', 'Feroe'],
    answer: 0,
    explanation:
      'La þ sobrevive solo en islandés. Noruega y Dinamarca usan ø/æ sin þ; el feroés usa ð pero no þ.',
    relatedClues: ['islandes-letras'],
  },
  {
    id: 'q-idioma-13', type: 'duelo', category: 'idioma', difficulty: 2,
    prompt: '"Diyarbakır Caddesi" — la ı sin punto delata...',
    options: ['Turquía', 'Azerbaiyán', 'Hungría', 'Rumanía'],
    answer: 0,
    explanation:
      'La ı sin punto es turca (el azerí también la usa, pero no tiene cobertura clásica jugable). Húngaro y rumano no la tienen.',
    relatedClues: ['turco-letras'],
  },
  {
    id: 'q-idioma-14', type: 'duelo', category: 'idioma', difficulty: 3,
    prompt: 'Escritura índica SIN línea horizontal superior, todo curvas y espirales. ¿País?',
    options: ['Sri Lanka', 'India (hindi)', 'Nepal', 'Bangladés'],
    answer: 0,
    explanation:
      'El cingalés es puramente curvo y sin la línea superior que une las letras en devanagari (hindi/nepalí). El bengalí mantiene línea con formas angulosas.',
    relatedClues: ['devanagari-vs-bengali'],
  },
  {
    id: 'q-idioma-15', type: 'pista', category: 'idioma', difficulty: 1,
    prompt: 'Cartel "Rua das Flores". ¿Qué países siguen vivos?',
    options: ['Portugal y Brasil', 'España y México', 'Italia y Rumanía', 'Francia y Bélgica'],
    answer: 0,
    explanation:
      '"Rua" es portugués: Portugal o Brasil (decide luego con placas, vegetación y tierra roja). España usa "Calle", Italia "Via", Francia "Rue".',
    relatedClues: ['espana-vs-portugal-idioma', 'portugues-tildes'],
  },

  // ── Toponimia ──
  {
    id: 'q-topo-1', type: 'pista', category: 'toponimia', difficulty: 1,
    prompt: 'Placa de calle: "Kossuth utca". ¿País?',
    options: ['Hungría', 'Polonia', 'Chequia', 'Rumanía'],
    answer: 0,
    explanation:
      '"utca" es "calle" en húngaro y no se parece a nada vecino. Polonia usa "ul.", Chequia "ulice", Rumanía "strada".',
    relatedClues: ['utca-hungria'],
  },
  {
    id: 'q-topo-2', type: 'pista', category: 'toponimia', difficulty: 2,
    prompt: 'Cartel verde con "Whangārei" y paisaje de colinas verdes. ¿País?',
    options: ['Nueva Zelanda', 'Australia', 'Reino Unido', 'Sudáfrica'],
    answer: 0,
    explanation:
      'El dígrafo Wh- inicial y los macrones son maoríes → Nueva Zelanda. Australia, UK y Sudáfrica no generan topónimos con esa fonotáctica.',
    relatedClues: ['maori-toponimos'],
  },
  {
    id: 'q-topo-3', type: 'duelo', category: 'toponimia', difficulty: 2,
    prompt: '"Jalan Merdeka" en el cartel. ¿Qué par de países sigue en juego?',
    options: ['Malasia e Indonesia', 'Tailandia y Laos', 'Filipinas y Vietnam', 'India y Sri Lanka'],
    answer: 0,
    explanation:
      '"Jalan" es malayo/indonesio (también Singapur y Brunéi). Tailandia y Laos usan sus propias escrituras; Filipinas usa inglés/tagalo sin "Jalan"; India/Sri Lanka tampoco.',
    relatedClues: ['jalan-sudeste'],
  },
  {
    id: 'q-topo-4', type: 'pista', category: 'toponimia', difficulty: 2,
    prompt: 'Señal bilingüe con "Llanfair..." arriba. ¿Dónde estás?',
    options: ['Gales', 'Irlanda', 'Escocia', 'Bretaña francesa'],
    answer: 0,
    explanation:
      'Llan- y las dobles LL son galesas. El irlandés usa Baile/Cill; el gaélico escocés Inver-/Glen-; el bretón Ker- (y Francia conduce por la derecha).',
    relatedClues: ['gales-llan'],
  },

  // ── Arquitectura ──
  {
    id: 'q-arq-1', type: 'pista', category: 'arquitectura', difficulty: 1,
    prompt: 'Pueblo de casas de madera rojo oscuro mate con esquinas blancas. ¿Región?',
    options: ['Nórdicos', 'Alpes', 'Balcanes', 'Báltico sur'],
    answer: 0,
    explanation:
      'El rojo falu es el sello escandinavo (y finlandés). Los Alpes usan madera natural y balcones floridos; Balcanes ladrillo y teja.',
    relatedClues: ['falu-rojo-nordico'],
  },
  {
    id: 'q-arq-2', type: 'duelo', category: 'arquitectura', difficulty: 2,
    prompt: 'Casas ALTAS de ladrillo rojo con balcones de madera, colinas rojizas y arrozales. ¿País?',
    options: ['Madagascar', 'Kenia', 'Ruanda', 'Bolivia'],
    answer: 0,
    explanation:
      'La casa alta de ladrillo con galería es única de Madagascar en África. Kenia y Ruanda construyen bajo con chapa; Bolivia encaja en ladrillo pero no con arrozales tropicales de colina.',
    relatedClues: ['madagascar-ladrillo'],
  },
  {
    id: 'q-arq-3', type: 'pista', category: 'arquitectura', difficulty: 2,
    prompt: 'Casas de 4 plantas MUY estrechas, de colores, con laterales ciegos. ¿País?',
    options: ['Vietnam', 'Tailandia', 'China', 'Filipinas'],
    answer: 0,
    explanation:
      'Son las "tube houses" vietnamitas, nacidas del impuesto por ancho de fachada. Tailandia y Filipinas usan shophouses más anchas; China no es jugable con cobertura estándar.',
    relatedClues: ['tube-houses-vietnam', 'paises-sin-cobertura'],
  },
  {
    id: 'q-arq-4', type: 'pista', category: 'arquitectura', difficulty: 2,
    prompt: 'Todos los edificios, hasta la gasolinera, tienen maderas pintadas y ventanas trapezoidales tradicionales. ¿País?',
    options: ['Bután', 'Nepal', 'India (Sikkim)', 'Laos'],
    answer: 0,
    explanation:
      'Bután obliga por ley al estilo tradicional en toda construcción: esa uniformidad no existe en Nepal, Sikkim ni Laos.',
    relatedClues: ['butan-arquitectura'],
  },
  {
    id: 'q-arq-5', type: 'descarte', category: 'arquitectura', difficulty: 2,
    prompt: 'Bloques prefabricados idénticos de 5-9 plantas en hileras. ¿Cuál de estas opciones queda DESCARTADA?',
    options: ['Países Bajos', 'Rusia', 'Letonia', 'Bulgaria'],
    answer: 0,
    explanation:
      'La vivienda masiva panelizada es herencia socialista: Rusia, el Báltico y Bulgaria la tienen a mares. Países Bajos construyó en ladrillo y baja altura comparativamente.',
    relatedClues: ['bloques-sovieticos'],
  },

  // ── Paisaje ──
  {
    id: 'q-paisaje-1', type: 'duelo', category: 'paisaje', difficulty: 2,
    prompt: 'Conducción izquierda, matorral fino denso y montaña de roca gris plegada. ¿País?',
    options: ['Sudáfrica', 'Australia', 'Nueva Zelanda', 'Kenia'],
    answer: 0,
    explanation:
      'Es fynbos del Cabo: Sudáfrica. El bush australiano es más ralo y con eucaliptos; NZ es verde húmedo; Kenia es sabana de acacias.',
    relatedClues: ['fynbos-cabo'],
  },
  {
    id: 'q-paisaje-2', type: 'pista', category: 'paisaje', difficulty: 1,
    prompt: 'Estepa sin vallas con varias rodadas de tierra en paralelo y un ger blanco a lo lejos. ¿País?',
    options: ['Mongolia', 'Kazajistán', 'Argentina', 'Australia'],
    answer: 0,
    explanation:
      'Las pistas múltiples sin infraestructura y los gers son Mongolia pura. Kazajistán tiene más asfalto; la pampa argentina y el outback australiano están cercados.',
    relatedClues: ['estepa-mongolia', 'mongolia-offroad'],
  },
  {
    id: 'q-paisaje-3', type: 'duelo', category: 'paisaje', difficulty: 2,
    prompt: 'Pradera verde intensa, ovejas y un helecho ARBÓREO junto a la carretera. ¿País?',
    options: ['Nueva Zelanda', 'Irlanda', 'Reino Unido', 'Tasmania (Australia)'],
    answer: 0,
    explanation:
      'El helecho arbóreo (ponga) delata Nueva Zelanda frente al verde británico/irlandés. Tasmania tiene helechos, pero con eucaliptos alrededor.',
    relatedClues: ['nz-helechos', 'eucaliptos-australia'],
  },
  {
    id: 'q-paisaje-4', type: 'combinada', category: 'paisaje', difficulty: 3,
    prompt: 'Eucaliptos junto a la carretera, conducción por la DERECHA y un cartel con "ã". ¿Dónde estás?',
    options: ['Portugal', 'Australia', 'Sudáfrica', 'Brasil'],
    answer: 0,
    explanation:
      'El eucalipto engaña: con conducción derecha y portugués, es Portugal (llenísimo de eucalipto plantado) o Brasil; el paisaje templado y la escala apuntan a Portugal. Australia y Sudáfrica conducen por la izquierda. Brasil es posible pero el eucalipto de carretera + "ã" es el combo clásico luso.',
    relatedClues: ['eucaliptos-australia', 'portugues-tildes', 'izquierda-mundo'],
  },
  {
    id: 'q-paisaje-5', type: 'pista', category: 'paisaje', difficulty: 1,
    prompt: 'Campos de lava con musgo, cero árboles, montañas negras. ¿País?',
    options: ['Islandia', 'Noruega', 'Escocia', 'Groenlandia'],
    answer: 0,
    explanation:
      'La lava musgosa sin árboles es Islandia. Noruega y Escocia tienen árboles o brezales distintos; Groenlandia apenas tiene cobertura de carretera.',
    relatedClues: ['islandia-sin-arboles'],
  },
  {
    id: 'q-paisaje-6', type: 'duelo', category: 'paisaje', difficulty: 2,
    prompt: 'Pradera con lomas suaves, afloramientos de piedra y palmeras sueltas. ¿Uruguay o Argentina?',
    options: ['Uruguay', 'Argentina'],
    answer: 0,
    explanation:
      'Las cuchillas onduladas con piedra y palmares butiá son uruguayas; la pampa argentina central es una tabla plana con cortavientos de álamos.',
    relatedClues: ['pampa-uy-ar'],
  },

  // ── Clima y sol ──
  {
    id: 'q-sol-1', type: 'pista', category: 'clima-sol', difficulty: 1,
    prompt: 'La brújula marca que el sol está hacia el NORTE a mediodía. ¿Qué sabes?',
    options: ['Estás en el hemisferio sur', 'Estás en el hemisferio norte', 'Estás cerca del polo', 'Nada: el sol no informa'],
    answer: 0,
    explanation:
      'Fuera de los trópicos, el sol culmina hacia el ecuador: verlo al norte implica hemisferio sur. Es una de las primeras comprobaciones en paisajes ambiguos.',
    relatedClues: ['sol-hemisferio'],
  },
  {
    id: 'q-sol-2', type: 'combinada', category: 'clima-sol', difficulty: 2,
    prompt: 'Sombras casi verticales, bruma blanca, vegetación exuberante. ¿Qué franja del planeta?',
    options: ['Franja ecuatorial', 'Mediterráneo en verano', 'Taiga en junio', 'Desierto templado'],
    answer: 0,
    explanation:
      'Sombra vertical = sol cenital = trópicos. El Mediterráneo y la taiga en verano tienen sombras largas oblicuas; el desierto carece de exuberancia.',
    relatedClues: ['luz-tropical'],
  },

  // ── Cultura ──
  {
    id: 'q-cultura-1', type: 'pista', category: 'cultura', difficulty: 1,
    prompt: 'Una casita-templo dorada sobre un pedestal frente a una tienda. ¿País?',
    options: ['Tailandia', 'Vietnam', 'Indonesia', 'India'],
    answer: 0,
    explanation:
      'Las casas de espíritus (san phra phum) son tailandesas. Vietnam usa altares dentro del local; Indonesia es mayoritariamente musulmana; India tiene santuarios de otro estilo.',
    relatedClues: ['casas-espiritus'],
  },
  {
    id: 'q-cultura-2', type: 'pista', category: 'cultura', difficulty: 1,
    prompt: 'Un minibús cromado y pintado de colores, alargado, lleno de pasajeros. ¿País?',
    options: ['Filipinas', 'Tailandia', 'Guatemala', 'Kenia'],
    answer: 0,
    explanation:
      'Es un jeepney, exclusivo de Filipinas. Guatemala repinta autobuses escolares (camionetas), Kenia usa matatus (vans), Tailandia songthaews: parecidos en espíritu, distintos en forma.',
    relatedClues: ['jeepneys-filipinas'],
  },
  {
    id: 'q-cultura-3', type: 'pista', category: 'cultura', difficulty: 2,
    prompt: 'Altar de carretera cubierto de banderas y telas ROJAS. ¿País?',
    options: ['Argentina', 'México', 'Perú', 'Brasil'],
    answer: 0,
    explanation:
      'El rojo del Gauchito Gil marca rutas argentinas. México tiene cruces y capillas multicolores; Perú apachetas y cruces; Brasil no tiene esa tradición roja de banquina.',
    relatedClues: ['gauchito-gil'],
  },
  {
    id: 'q-cultura-4', type: 'duelo', category: 'cultura', difficulty: 2,
    prompt: 'Rickshaw de PEDAL decorado con pintura de colores en una calle abarrotada. ¿País?',
    options: ['Bangladés', 'India', 'Tailandia', 'Vietnam'],
    answer: 0,
    explanation:
      'El rickshaw de pedal pintado es el icono de Bangladés. India domina el auto-rickshaw motorizado; Tailandia el tuk-tuk; Vietnam la moto.',
    relatedClues: ['rickshaws-por-pais'],
  },
  {
    id: 'q-cultura-5', type: 'pista', category: 'cultura', difficulty: 1,
    prompt: 'La palabra "TOPE" pintada antes de un badén. ¿País?',
    options: ['México', 'España', 'Colombia', 'Chile'],
    answer: 0,
    explanation:
      '"Tope" es el badén mexicano. España señaliza "resalto", Colombia "reductor", Chile "lomo de toro": la palabra elegida delata el país.',
    relatedClues: ['mexico-topes'],
  },

  // ── Meta ──
  {
    id: 'q-meta-1', type: 'pista', category: 'meta-camara', difficulty: 1,
    prompt: 'Miras hacia abajo y ves un TUBO (snorkel) en la esquina del coche. Sabana y conducción izquierda. ¿País?',
    options: ['Kenia', 'Sudáfrica', 'Botsuana', 'Uganda'],
    answer: 0,
    explanation:
      'El snorkel del coche de Google es el meta clásico de Kenia. Sudáfrica, Botsuana y Uganda comparten sabana y conducción izquierda, pero no el snorkel.',
    relatedClues: ['kenia-snorkel'],
  },
  {
    id: 'q-meta-2', type: 'pista', category: 'meta-camara', difficulty: 2,
    prompt: 'Un coche de policía te acompaña en TODA la ronda. ¿País?',
    options: ['Nigeria', 'Ghana', 'Kenia', 'Senegal'],
    answer: 0,
    explanation:
      'La cobertura nigeriana se grabó con escolta: el vehículo persistente es la firma. Ghana muestra cinta en el coche, Kenia snorkel, Senegal ninguno de estos.',
    relatedClues: ['nigeria-escolta', 'ghana-cinta'],
  },
  {
    id: 'q-meta-3', type: 'descarte', category: 'meta-cobertura', difficulty: 2,
    prompt: 'Crees estar viendo "Marruecos". ¿Qué deberías pensar en su lugar?',
    options: ['Túnez o el sur de España', 'Egipto', 'Mauritania', 'Marruecos: tiene cobertura normal'],
    answer: 0,
    explanation:
      'Marruecos NO tiene cobertura oficial de coche: lo que parece Marruecos suele ser Túnez (árabe + francés) o Andalucía. Egipto y Mauritania tampoco tienen cobertura jugable estándar.',
    relatedClues: ['paises-sin-cobertura'],
  },
  {
    id: 'q-meta-4', type: 'pista', category: 'meta-camara', difficulty: 2,
    prompt: 'Imagen nítida con colores suaves y un halo blanco alrededor del sol. ¿Qué generación de cámara?',
    options: ['Gen 3', 'Gen 1', 'Gen 2', 'Gen 4'],
    answer: 0,
    explanation:
      'El halo solar con buena nitidez es típico de Gen 3. Gen 1-2 son visiblemente peores; Gen 4 es HDR vívido de contraste alto sin ese halo.',
    relatedClues: ['generaciones-camara'],
  },
  {
    id: 'q-meta-5', type: 'pista', category: 'meta-cobertura', difficulty: 1,
    prompt: 'Edificios residenciales enteros DIFUMINADOS en una ciudad de imagen antigua. ¿País?',
    options: ['Alemania', 'Francia', 'Suiza', 'Países Bajos'],
    answer: 0,
    explanation:
      'El difuminado masivo por privacidad + cobertura 2008-09 es la Alemania clásica de GeoGuessr. Francia, Suiza y Países Bajos difuminan casos puntuales, no manzanas enteras.',
    relatedClues: ['alemania-cobertura'],
  },
  {
    id: 'q-meta-6', type: 'general', category: 'meta-cobertura', difficulty: 2,
    prompt: 'En NMPZ (sin mover, girar ni zoom), ¿qué tipo de pista GANA peso?',
    options: [
      'Colores, líneas y meta del coche visibles de frente',
      'Carteles lejanos que requieren zoom',
      'Explorar hasta el siguiente cruce',
      'Ninguna: NMPZ es azar',
    ],
    answer: 0,
    explanation:
      'Sin zoom ni movimiento solo queda lo inmediato: líneas, vegetación, generación de cámara y partes del coche. Los carteles lejanos y los cruces exigen zoom o movimiento, que no tienes.',
    relatedClues: ['modos-juego'],
  },

  // ── Generales ──
  {
    id: 'q-general-1', type: 'general', category: 'paisaje', difficulty: 1,
    prompt: '¿Cuál es la actitud correcta ante una pista "fuerte" aislada?',
    options: [
      'Buscar una segunda pista independiente que la confirme',
      'Apostar inmediatamente',
      'Ignorarla si contradice la primera impresión',
      'Las pistas fuertes no existen',
    ],
    answer: 0,
    explanation:
      'Hasta la evidencia fuerte tiene excepciones (coberturas viejas, objetos importados, fronteras). Dos pistas independientes que apuntan al mismo país valen más que una sola muy llamativa.',
    relatedClues: ['bolardos-como-usarlos', 'detectar-sentido'],
  },
  {
    id: 'q-general-2', type: 'combinada', category: 'idioma', difficulty: 3,
    prompt: 'Cartel con "ö" y "ä", vocales dobles tipo "aa", y OTRO cartel en sueco al lado. ¿Dónde estás?',
    options: ['Costa de Finlandia', 'Suecia', 'Estonia', 'Åland... es decir, Finlandia igualmente'],
    answer: 0,
    explanation:
      'Finés + sueco juntos = Finlandia bilingüe costera. En Suecia no verías finés; en Estonia verías õ y "tänav". (Y sí: Åland también es Finlandia.)',
    relatedClues: ['fines-estonio', 'senales-bilingues'],
  },
  // ── Mobiliario y marcas ──
  {
    id: 'q-mob-1', type: 'pista', category: 'mobiliario', difficulty: 1,
    prompt: 'Un buzón cilíndrico ROJO en la acera y carteles en alfabeto latino. ¿País más probable?',
    options: ['Reino Unido', 'Estados Unidos', 'Francia', 'Países Bajos'],
    answer: 0,
    explanation:
      'El pilar rojo es el buzón británico clásico (Japón también usa rojo cilíndrico, pero con japonés alrededor). EE. UU. usa azul, Francia amarillo y Países Bajos naranja.',
    relatedClues: ['buzones-colores'],
  },
  {
    id: 'q-mob-2', type: 'duelo', category: 'mobiliario', difficulty: 2,
    prompt: 'Semáforo montado en HORIZONTAL con brazo largo, en Asia Oriental. ¿Qué par queda en juego?',
    options: ['Japón y Corea del Sur', 'Taiwán y Hong Kong', 'Tailandia y Vietnam', 'China y Mongolia'],
    answer: 0,
    explanation:
      'Japón y Corea montan los semáforos en horizontal; Taiwán y Hong Kong en vertical. La escritura decide luego entre los dos (kana vs hangul).',
    relatedClues: ['semaforos-horizontales', 'japones-vs-coreano-vs-chino'],
  },
  {
    id: 'q-mob-3', type: 'pista', category: 'cultura', difficulty: 1,
    prompt: 'Gasolinera con rótulo "Pemex". ¿País?',
    options: ['México', 'Colombia', 'Argentina', 'España'],
    answer: 0,
    explanation:
      'Pemex es la petrolera estatal mexicana y solo opera allí. YPF sería Argentina, Terpel Colombia; en España verías Repsol/Cepsa.',
    relatedClues: ['gasolineras-marcas'],
  },
  {
    id: 'q-mob-4', type: 'pista', category: 'cultura', difficulty: 2,
    prompt: 'Cúpulas de hormigón semienterradas repartidas por campos y cunetas. ¿País?',
    options: ['Albania', 'Serbia', 'Bulgaria', 'Grecia'],
    answer: 0,
    explanation:
      'Son los búnkeres de Hoxha: Albania construyó cientos de miles. Ningún vecino tiene nada parecido a esa escala.',
    relatedClues: ['albania-bunkeres'],
  },
  {
    id: 'q-mob-5', type: 'duelo', category: 'mobiliario', difficulty: 3,
    prompt: 'En Francia rural, el hito kilométrico tiene el casquete AMARILLO. ¿En qué tipo de carretera estás?',
    options: ['Departamental (D)', 'Nacional (N)', 'Autopista (A)', 'Vía municipal'],
    answer: 0,
    explanation:
      'Las bornes francesas llevan casquete amarillo en las departamentales y rojo en las nacionales: te dice qué letra buscar en el mapa sin ver un solo cartel.',
    relatedClues: ['hitos-kilometricos'],
  },
  {
    id: 'q-general-3', type: 'descarte', category: 'meta-cobertura', difficulty: 3,
    prompt: 'Ves caracteres chinos simplificados y carreteras modernas enormes. ¿Por qué NO deberías responder "China"?',
    options: [
      'China no tiene cobertura oficial de coche: será Taiwán, HK o un barrio chino',
      'China prohíbe los coches',
      'El chino simplificado no existe en señales',
      'Sí debería responder China',
    ],
    answer: 0,
    explanation:
      'China continental carece de cobertura oficial de Street View: el chino que ves estará en Taiwán (tradicional), Hong Kong, Singapur, Malasia o un chinatown. Comprueba el sentido del tráfico y el entorno.',
    relatedClues: ['paises-sin-cobertura', 'japones-vs-coreano-vs-chino'],
  },
]

export const QUESTION_MAP = new Map(QUESTIONS.map((q) => [q.id, q]))

export function questionsForClue(clueId: string): Question[] {
  return QUESTIONS.filter((q) => q.relatedClues?.includes(clueId))
}
