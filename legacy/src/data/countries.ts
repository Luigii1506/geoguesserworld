import type { Country } from './types'

// Países con cobertura jugable en GeoGuessr. Los quickFacts son resúmenes
// operativos; la evidencia detallada vive en las fichas (clues). Las notas de
// cobertura son "meta" y pueden caducar con nuevas actualizaciones de Google.

export const COUNTRIES: Country[] = [
  // ───────────────────────────── EUROPA ─────────────────────────────
  {
    code: 'no', name: 'Noruega', continent: 'europa', flag: '🇳🇴',
    driving: 'derecha', tld: '.no', languages: ['noruego'], scripts: ['latino (ø, å, æ)'],
    quickFacts: [
      { category: 'lineas-viales', fact: 'Línea central amarilla; bordes blancos.' },
      { category: 'paisaje', fact: 'Fiordos, túneles frecuentes, montañas hasta el mar.' },
      { category: 'idioma', fact: 'ø, å, æ compartidas con danés; "gate/veien" en calles.' },
      { category: 'arquitectura', fact: 'Casas de madera pintadas, muchas blancas o rojo falu.' },
    ],
  },
  {
    code: 'se', name: 'Suecia', continent: 'europa', flag: '🇸🇪',
    driving: 'derecha', tld: '.se', languages: ['sueco'], scripts: ['latino (ö, ä, å)'],
    quickFacts: [
      { category: 'lineas-viales', fact: 'Líneas blancas; carreteras 2+1 con cable central son típicas.' },
      { category: 'senales', fact: 'Señales de advertencia con fondo amarillo.' },
      { category: 'idioma', fact: 'ö y ä (nunca ø/æ); "gatan/vägen" en calles.' },
      { category: 'arquitectura', fact: 'Casas de madera rojo falu con esquinas blancas.' },
    ],
  },
  {
    code: 'fi', name: 'Finlandia', continent: 'europa', flag: '🇫🇮',
    driving: 'derecha', tld: '.fi', languages: ['finés', 'sueco'], scripts: ['latino (ä, ö, dobles vocales)'],
    quickFacts: [
      { category: 'lineas-viales', fact: 'Líneas blancas hoy; cobertura antigua puede mostrar amarillas.' },
      { category: 'idioma', fact: 'Palabras largas con vocales dobles (aa, ii, yy); "tie/katu" en calles. Bilingüe con sueco en la costa.' },
      { category: 'paisaje', fact: 'Terreno llano, abedules y pinos, miles de lagos.' },
      { category: 'senales', fact: 'Advertencias con fondo amarillo, como Suecia.' },
    ],
  },
  {
    code: 'dk', name: 'Dinamarca', continent: 'europa', flag: '🇩🇰',
    driving: 'derecha', tld: '.dk', languages: ['danés'], scripts: ['latino (ø, å, æ)'],
    quickFacts: [
      { category: 'senales', fact: 'Advertencias con fondo BLANCO: separa de Suecia/Finlandia/Islandia (amarillo).' },
      { category: 'paisaje', fact: 'Llano, agrícola, aerogeneradores frecuentes.' },
      { category: 'idioma', fact: 'ø/å/æ como noruego; "vej/gade" en calles.' },
      { category: 'circulacion', fact: 'Infraestructura ciclista muy desarrollada.' },
    ],
  },
  {
    code: 'is', name: 'Islandia', continent: 'europa', flag: '🇮🇸',
    driving: 'derecha', tld: '.is', languages: ['islandés'], scripts: ['latino (þ, ð, æ)'],
    quickFacts: [
      { category: 'idioma', fact: 'Letras þ y ð: prácticamente exclusivas de Islandia.' },
      { category: 'paisaje', fact: 'Sin árboles casi, lava, musgo, montañas volcánicas.' },
      { category: 'lineas-viales', fact: 'Línea central amarilla.' },
      { category: 'toponimia', fact: 'Sufijos -fjörður, -vík, -nes.' },
    ],
  },
  {
    code: 'ee', name: 'Estonia', continent: 'europa', flag: '🇪🇪',
    driving: 'derecha', tld: '.ee', languages: ['estonio'], scripts: ['latino (õ, ä, ö, ü)'],
    quickFacts: [
      { category: 'idioma', fact: 'La letra õ distingue estonio de finés; parecido al finés (vocales dobles).' },
      { category: 'paisaje', fact: 'Bosques boreales y llanura; similar a Finlandia.' },
      { category: 'toponimia', fact: '"maantee" (carretera), "tänav" (calle).' },
    ],
  },
  {
    code: 'lv', name: 'Letonia', continent: 'europa', flag: '🇱🇻',
    driving: 'derecha', tld: '.lv', languages: ['letón'], scripts: ['latino (ā, ē, ī, ū con macrones)'],
    quickFacts: [
      { category: 'idioma', fact: 'Macrones (ā, ē, ī, ū): rasgo casi único del letón en Europa.' },
      { category: 'toponimia', fact: '"iela" (calle) en todos los carteles urbanos.' },
      { category: 'paisaje', fact: 'Bosque mixto y campo llano; carreteras secundarias de grava.' },
    ],
  },
  {
    code: 'lt', name: 'Lituania', continent: 'europa', flag: '🇱🇹',
    driving: 'derecha', tld: '.lt', languages: ['lituano'], scripts: ['latino (ė, ų, ž, č)'],
    quickFacts: [
      { category: 'idioma', fact: 'ė (punto sobre la e) y ų son marcas del lituano; "gatvė" = calle.' },
      { category: 'paisaje', fact: 'Llano, agrícola; algo más próspero visualmente que Letonia rural.' },
    ],
  },
  {
    code: 'pl', name: 'Polonia', continent: 'europa', flag: '🇵🇱',
    driving: 'derecha', tld: '.pl', languages: ['polaco'], scripts: ['latino (ł, ą, ę, ż, ś)'],
    quickFacts: [
      { category: 'idioma', fact: 'ł (L tachada) es casi exclusiva del polaco; "ul." antes del nombre de la calle.' },
      { category: 'senales', fact: 'Señales de advertencia con fondo amarillo.' },
      { category: 'arquitectura', fact: 'Mezcla de bloques socialistas y casas cúbicas de ladrillo/estuco.' },
      { category: 'matriculas', fact: 'Blancas con franja azul UE.' },
    ],
  },
  {
    code: 'de', name: 'Alemania', continent: 'europa', flag: '🇩🇪',
    driving: 'derecha', tld: '.de', languages: ['alemán'], scripts: ['latino (ß, ü, ö, ä)'],
    quickFacts: [
      { category: 'idioma', fact: 'ß existe en alemán (no en Austria la verás menos... también se usa); "-straße" en calles.' },
      { category: 'meta-cobertura', fact: 'Cobertura histórica limitada (ciudades 2008-09, edificios difuminados); desde 2023 hay cobertura nueva.' },
      { category: 'bolardos', fact: 'Bolardo blanco con parte superior inclinada y reflector en banda negra.' },
    ],
    coverage: 'Durante años solo grandes ciudades con imágenes de 2008-09 y muchos edificios borrosos; cobertura renovada desde 2023.',
  },
  {
    code: 'nl', name: 'Países Bajos', continent: 'europa', flag: '🇳🇱',
    driving: 'derecha', tld: '.nl', languages: ['neerlandés'], scripts: ['latino (ij, aa, ee)'],
    quickFacts: [
      { category: 'matriculas', fact: 'Matrículas AMARILLAS delante y detrás: muy visibles.' },
      { category: 'circulacion', fact: 'Carriles bici rojizos por todas partes.' },
      { category: 'paisaje', fact: 'Totalmente llano, canales, campos ordenados.' },
      { category: 'arquitectura', fact: 'Ladrillo visto, casas estrechas, persianas grandes.' },
      { category: 'idioma', fact: 'Dobles vocales (aa, ee, oo) y "ij"; "-straat" en calles.' },
    ],
  },
  {
    code: 'be', name: 'Bélgica', continent: 'europa', flag: '🇧🇪',
    driving: 'derecha', tld: '.be', languages: ['neerlandés', 'francés', 'alemán'], scripts: ['latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Bilingüe: carteles en neerlandés (Flandes), francés (Valonia) o ambos (Bruselas).' },
      { category: 'matriculas', fact: 'Blancas con caracteres ROJOS: casi únicas en Europa.' },
      { category: 'arquitectura', fact: 'Ladrillo oscuro, casas adosadas heterogéneas.' },
    ],
  },
  {
    code: 'lu', name: 'Luxemburgo', continent: 'europa', flag: '🇱🇺',
    driving: 'derecha', tld: '.lu', languages: ['luxemburgués', 'francés', 'alemán'], scripts: ['latino'],
    quickFacts: [
      { category: 'matriculas', fact: 'Amarillas detrás, blancas delante (como Reino Unido pero conduciendo por la derecha).' },
      { category: 'idioma', fact: 'Mezcla de francés y alemán en señales.' },
    ],
  },
  {
    code: 'fr', name: 'Francia', continent: 'europa', flag: '🇫🇷',
    driving: 'derecha', tld: '.fr', languages: ['francés'], scripts: ['latino (é, è, ç, à)'],
    quickFacts: [
      { category: 'bolardos', fact: 'Bolardo blanco con franja ROJA cerca de la parte superior: clásico francés.' },
      { category: 'senales', fact: 'Carteles direccionales blancos con borde... y numeración D (departamental) y N (nacional).' },
      { category: 'arquitectura', fact: 'Persianas de madera, piedra clara, pueblos compactos.' },
      { category: 'toponimia', fact: '"Rue", "Avenue", "Route de..." en placas azules o blancas.' },
    ],
  },
  {
    code: 'es', name: 'España', continent: 'europa', flag: '🇪🇸',
    driving: 'derecha', tld: '.es', languages: ['español', 'catalán', 'gallego', 'euskera'], scripts: ['latino (ñ)'],
    quickFacts: [
      { category: 'idioma', fact: 'ñ; cooficiales: catalán (ny, l·l), gallego (-x-), euskera (tx, k).' },
      { category: 'senales', fact: 'Numeración A-/AP- (autovías), N- (nacionales); carteles azules en autovía.' },
      { category: 'paisaje', fact: 'Olivares, meseta seca, pueblos blancos en el sur.' },
      { category: 'arquitectura', fact: 'Bloques de pisos incluso en ciudades pequeñas; teja árabe.' },
    ],
  },
  {
    code: 'pt', name: 'Portugal', continent: 'europa', flag: '🇵🇹',
    driving: 'derecha', tld: '.pt', languages: ['portugués'], scripts: ['latino (ã, õ, ç)'],
    quickFacts: [
      { category: 'idioma', fact: 'ã y õ delatan portugués; "Rua" en calles.' },
      { category: 'arquitectura', fact: 'Azulejos en fachadas, calzada portuguesa (adoquín blanco-negro).' },
      { category: 'paisaje', fact: 'Eucaliptos y pinos; terreno más verde y ondulado que la meseta española.' },
      { category: 'senales', fact: 'Numeración N (nacionales), A (autopistas), M (municipales).' },
    ],
  },
  {
    code: 'it', name: 'Italia', continent: 'europa', flag: '🇮🇹',
    driving: 'derecha', tld: '.it', languages: ['italiano'], scripts: ['latino'],
    quickFacts: [
      { category: 'senales', fact: 'Carteles direccionales: azul = carretera normal, verde = autopista (al revés que España/Francia).' },
      { category: 'idioma', fact: 'Dobles consonantes, palabras en -zione, -ità; "Via" en calles.' },
      { category: 'arquitectura', fact: 'Estuco ocre/amarillo, persianas, teja árabe.' },
      { category: 'matriculas', fact: 'Blancas con franjas azules en AMBOS lados.' },
    ],
  },
  {
    code: 'ch', name: 'Suiza', continent: 'europa', flag: '🇨🇭',
    driving: 'derecha', tld: '.ch', languages: ['alemán', 'francés', 'italiano', 'romanche'], scripts: ['latino'],
    quickFacts: [
      { category: 'senales', fact: 'Carteles direccionales azules; autopista en verde. Sin franja UE en matrículas.' },
      { category: 'paisaje', fact: 'Alpes, prados impecables, chalets de madera.' },
      { category: 'idioma', fact: 'El idioma del cartel te sitúa en la región (alemán/francés/italiano).' },
    ],
  },
  {
    code: 'at', name: 'Austria', continent: 'europa', flag: '🇦🇹',
    driving: 'derecha', tld: '.at', languages: ['alemán'], scripts: ['latino'],
    quickFacts: [
      { category: 'senales', fact: 'Advertencias con fondo blanco y borde rojo; carteles de autopista azules.' },
      { category: 'paisaje', fact: 'Alpino, prados y bosques; muy parecido a Eslovenia y Baviera.' },
      { category: 'meta-cobertura', fact: 'Cobertura histórica escasa; ampliada en años recientes.' },
    ],
  },
  {
    code: 'cz', name: 'Chequia', continent: 'europa', flag: '🇨🇿',
    driving: 'derecha', tld: '.cz', languages: ['checo'], scripts: ['latino (ř, ů, ě)'],
    quickFacts: [
      { category: 'idioma', fact: 'ř y ů son exclusivas del checo (el eslovaco usa ľ, ĺ, ô).' },
      { category: 'bolardos', fact: 'Bolardo blanco con banda reflectante naranja cerca del tope.' },
      { category: 'arquitectura', fact: 'Pueblos compactos de estuco, tejados rojos.' },
    ],
  },
  {
    code: 'sk', name: 'Eslovaquia', continent: 'europa', flag: '🇸🇰',
    driving: 'derecha', tld: '.sk', languages: ['eslovaco'], scripts: ['latino (ľ, ĺ, ô, ä)'],
    quickFacts: [
      { category: 'idioma', fact: 'ľ y ô delatan eslovaco frente a checo (ř, ů).' },
      { category: 'paisaje', fact: 'Más montañoso que Chequia (Tatras); pueblos alargados junto a la carretera.' },
    ],
  },
  {
    code: 'hu', name: 'Hungría', continent: 'europa', flag: '🇭🇺',
    driving: 'derecha', tld: '.hu', languages: ['húngaro'], scripts: ['latino (ő, ű)'],
    quickFacts: [
      { category: 'idioma', fact: 'ő y ű (doble acento agudo): exclusivas del húngaro. "utca" = calle.' },
      { category: 'postes', fact: 'Postes de hormigón con agujeros (en escalera): clásico húngaro.' },
      { category: 'paisaje', fact: 'Llanura panónica, girasol y maíz.' },
    ],
  },
  {
    code: 'ro', name: 'Rumanía', continent: 'europa', flag: '🇷🇴',
    driving: 'derecha', tld: '.ro', languages: ['rumano'], scripts: ['latino (ă, â, î, ș, ț)'],
    quickFacts: [
      { category: 'idioma', fact: 'ș y ț (coma debajo) + ă: combinación única del rumano; lengua romance reconocible.' },
      { category: 'cultura', fact: 'Carros de caballos, pozos con tejadillo, mucha vida rural visible.' },
      { category: 'arquitectura', fact: 'Casas con tejados altos, a veces de chapa decorada.' },
    ],
  },
  {
    code: 'bg', name: 'Bulgaria', continent: 'europa', flag: '🇧🇬',
    driving: 'derecha', tld: '.bg', languages: ['búlgaro'], scripts: ['cirílico'],
    quickFacts: [
      { category: 'idioma', fact: 'Cirílico con ъ muy frecuente (напр. "България"); sin і ni ї (eso es ucraniano).' },
      { category: 'paisaje', fact: 'Montañas suaves, pueblos con teja árabe: cirílico + Mediterráneo ≈ Bulgaria.' },
    ],
  },
  {
    code: 'gr', name: 'Grecia', continent: 'europa', flag: '🇬🇷',
    driving: 'derecha', tld: '.gr', languages: ['griego'], scripts: ['griego'],
    quickFacts: [
      { category: 'idioma', fact: 'Alfabeto griego (Σ, Δ, Ω...); carteles viales bilingües griego/latino.' },
      { category: 'paisaje', fact: 'Olivos, mar, montes áridos; casas cúbicas blancas en islas.' },
      { category: 'arquitectura', fact: 'Hormigón con azoteas planas y varillas vistas, incluso en pueblos.' },
    ],
  },
  {
    code: 'hr', name: 'Croacia', continent: 'europa', flag: '🇭🇷',
    driving: 'derecha', tld: '.hr', languages: ['croata'], scripts: ['latino (č, ć, ž, š)'],
    quickFacts: [
      { category: 'idioma', fact: 'Solo latino (Serbia mezcla cirílico); "ulica" = calle.' },
      { category: 'paisaje', fact: 'Costa adriática: piedra caliza, teja árabe, mar.' },
    ],
  },
  {
    code: 'si', name: 'Eslovenia', continent: 'europa', flag: '🇸🇮',
    driving: 'derecha', tld: '.si', languages: ['esloveno'], scripts: ['latino (č, š, ž)'],
    quickFacts: [
      { category: 'paisaje', fact: 'Alpino y muy verde: fácil de confundir con Austria.' },
      { category: 'idioma', fact: 'Esloveno: solo č/š/ž como diacríticos (sin ć ni đ del croata).' },
      { category: 'arquitectura', fact: 'Iglesias con campanario puntiagudo en cada pueblo, como Austria.' },
    ],
  },
  {
    code: 'rs', name: 'Serbia', continent: 'europa', flag: '🇷🇸',
    driving: 'derecha', tld: '.rs', languages: ['serbio'], scripts: ['cirílico', 'latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Mezcla de cirílico y latino en los mismos lugares; cirílico con ћ, ђ, џ.' },
      { category: 'paisaje', fact: 'Interior continental: llanura al norte, montes al sur.' },
    ],
  },
  {
    code: 'me', name: 'Montenegro', continent: 'europa', flag: '🇲🇪',
    driving: 'derecha', tld: '.me', languages: ['montenegrino'], scripts: ['latino', 'cirílico'],
    quickFacts: [
      { category: 'paisaje', fact: 'Montañas abruptas junto al Adriático.' },
    ],
  },
  {
    code: 'mk', name: 'Macedonia del Norte', continent: 'europa', flag: '🇲🇰',
    driving: 'derecha', tld: '.mk', languages: ['macedonio', 'albanés'], scripts: ['cirílico', 'latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Cirílico con ѓ y ќ (únicas del macedonio); albanés en el oeste.' },
    ],
  },
  {
    code: 'al', name: 'Albania', continent: 'europa', flag: '🇦🇱',
    driving: 'derecha', tld: '.al', languages: ['albanés'], scripts: ['latino (ë, ç)'],
    quickFacts: [
      { category: 'idioma', fact: 'ë constante a final de palabra (Shqipëri); combinaciones xh, zh.' },
      { category: 'cultura', fact: 'Búnkeres de hormigón dispersos, Mercedes antiguos abundantes.' },
    ],
  },
  {
    code: 'ua', name: 'Ucrania', continent: 'europa', flag: '🇺🇦',
    driving: 'derecha', tld: '.ua', languages: ['ucraniano'], scripts: ['cirílico (і, ї, є)'],
    quickFacts: [
      { category: 'idioma', fact: 'Cirílico CON і/ї/є → ucraniano; el ruso no las usa (ы, ё).' },
      { category: 'paisaje', fact: 'Estepa agrícola inmensa, suelos negros, campos de girasol.' },
    ],
  },
  {
    code: 'ru', name: 'Rusia', continent: 'europa', flag: '🇷🇺',
    driving: 'derecha', tld: '.ru', languages: ['ruso'], scripts: ['cirílico (ы, ъ, ё)'],
    quickFacts: [
      { category: 'idioma', fact: 'Cirílico con ы → ruso (el ucraniano no la tiene).' },
      { category: 'bolardos', fact: 'Delineadores con franjas negras y blancas.' },
      { category: 'paisaje', fact: 'Del Báltico al Pacífico: abedules, taiga, estepa; pueblos con casas de madera e izbas.' },
      { category: 'postes', fact: 'Hormigón, a menudo con brazo diagonal de refuerzo.' },
    ],
  },
  {
    code: 'gb', name: 'Reino Unido', continent: 'europa', flag: '🇬🇧',
    driving: 'izquierda', tld: '.uk', languages: ['inglés', 'galés', 'gaélico'], scripts: ['latino'],
    quickFacts: [
      { category: 'circulacion', fact: 'Izquierda; único junto a Irlanda/Malta/Chipre en Europa.' },
      { category: 'matriculas', fact: 'Blanca delante, AMARILLA detrás.' },
      { category: 'lineas-viales', fact: 'Dobles líneas amarillas de aparcamiento junto al bordillo.' },
      { category: 'arquitectura', fact: 'Ladrillo, casas adosadas, setos; en Gales carteles bilingües (Llan-, -fawr).' },
    ],
  },
  {
    code: 'ie', name: 'Irlanda', continent: 'europa', flag: '🇮🇪',
    driving: 'izquierda', tld: '.ie', languages: ['inglés', 'irlandés'], scripts: ['latino'],
    quickFacts: [
      { category: 'senales', fact: 'Señales bilingües (irlandés en cursiva arriba); advertencias en rombo amarillo estilo americano.' },
      { category: 'lineas-viales', fact: 'Línea lateral amarilla discontinua frecuente.' },
      { category: 'paisaje', fact: 'Setos altos, verde intenso, muros de piedra.' },
    ],
  },
  {
    code: 'mt', name: 'Malta', continent: 'europa', flag: '🇲🇹',
    driving: 'izquierda', tld: '.mt', languages: ['maltés', 'inglés'], scripts: ['latino (ħ, għ)'],
    quickFacts: [
      { category: 'idioma', fact: 'Maltés con ħ y għ: único. Mezcla con inglés.' },
      { category: 'arquitectura', fact: 'Piedra caliza dorada en todo; balcones cerrados de colores.' },
    ],
  },
  {
    code: 'cy', name: 'Chipre', continent: 'europa', flag: '🇨🇾',
    driving: 'izquierda', tld: '.cy', languages: ['griego', 'turco'], scripts: ['griego', 'latino'],
    quickFacts: [
      { category: 'circulacion', fact: 'Griego + conducir por la IZQUIERDA = Chipre (Grecia va por la derecha).' },
    ],
  },

  // ───────────────────────────── ASIA ─────────────────────────────
  {
    code: 'tr', name: 'Turquía', continent: 'asia', flag: '🇹🇷',
    driving: 'derecha', tld: '.tr', languages: ['turco'], scripts: ['latino (ı, ğ, ş)'],
    quickFacts: [
      { category: 'idioma', fact: 'ı sin punto, ğ y ş; palabras largas aglutinadas.' },
      { category: 'cultura', fact: 'Banderas turcas y bustos de Atatürk por doquier; minaretes tipo lápiz.' },
      { category: 'arquitectura', fact: 'Bloques de pisos nuevos (TOKİ) incluso en ciudades medianas.' },
    ],
  },
  {
    code: 'ge', name: 'Georgia', continent: 'asia', flag: '🇬🇪',
    driving: 'derecha', tld: '.ge', languages: ['georgiano'], scripts: ['georgiano'],
    quickFacts: [
      { category: 'idioma', fact: 'Alfabeto georgiano: letras redondas con colas, únicas en el mundo.' },
      { category: 'paisaje', fact: 'Cáucaso: montañas enormes, viñedos, ganado en la carretera.' },
      { category: 'cultura', fact: 'Ladas y Mercedes viejos; iglesias ortodoxas de piedra en cerros.' },
    ],
  },
  {
    code: 'il', name: 'Israel', continent: 'asia', flag: '🇮🇱',
    driving: 'derecha', tld: '.il', languages: ['hebreo', 'árabe'], scripts: ['hebreo', 'árabe', 'latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Señales trilingües: hebreo + árabe + latino.' },
      { category: 'matriculas', fact: 'Amarillas delante y detrás.' },
    ],
  },
  {
    code: 'jo', name: 'Jordania', continent: 'asia', flag: '🇯🇴',
    driving: 'derecha', tld: '.jo', languages: ['árabe'], scripts: ['árabe', 'latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Desierto rocoso beige; olivos en el norte.' },
      { category: 'idioma', fact: 'Árabe con transliteración al inglés en señales.' },
    ],
  },
  {
    code: 'ae', name: 'Emiratos Árabes Unidos', continent: 'asia', flag: '🇦🇪',
    driving: 'derecha', tld: '.ae', languages: ['árabe', 'inglés'], scripts: ['árabe', 'latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Desierto de arena naranja, autopistas enormes, rascacielos.' },
    ],
  },
  {
    code: 'qa', name: 'Catar', continent: 'asia', flag: '🇶🇦',
    driving: 'derecha', tld: '.qa', languages: ['árabe', 'inglés'], scripts: ['árabe', 'latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Desierto llano y claro, construcción constante.' },
    ],
  },
  {
    code: 'kz', name: 'Kazajistán', continent: 'asia', flag: '🇰🇿',
    driving: 'derecha', tld: '.kz', languages: ['kazajo', 'ruso'], scripts: ['cirílico (ә, ғ, қ, ң, ө, ұ, ү)'],
    quickFacts: [
      { category: 'idioma', fact: 'Cirílico con letras extra (ә, қ, ң...): kazajo.' },
      { category: 'paisaje', fact: 'Estepa infinita y llana.' },
    ],
  },
  {
    code: 'kg', name: 'Kirguistán', continent: 'asia', flag: '🇰🇬',
    driving: 'derecha', tld: '.kg', languages: ['kirguís', 'ruso'], scripts: ['cirílico (ө, ү, ң)'],
    quickFacts: [
      { category: 'paisaje', fact: 'Montañas nevadas enormes (Tian Shan) de fondo casi siempre.' },
      { category: 'cultura', fact: 'Ladas y Audis viejos; yurtas en verano.' },
    ],
  },
  {
    code: 'mn', name: 'Mongolia', continent: 'asia', flag: '🇲🇳',
    driving: 'derecha', tld: '.mn', languages: ['mongol'], scripts: ['cirílico (ө, ү)'],
    quickFacts: [
      { category: 'paisaje', fact: 'Estepa sin vallas ni árboles; pistas de tierra múltiples en paralelo.' },
      { category: 'cultura', fact: 'Gers (yurtas) blancos; ganado suelto.' },
      { category: 'idioma', fact: 'Cirílico con ө y ү frecuentes.' },
    ],
  },
  {
    code: 'in', name: 'India', continent: 'asia', flag: '🇮🇳',
    driving: 'izquierda', tld: '.in', languages: ['hindi', 'inglés', '+20 oficiales'], scripts: ['devanagari', 'latino', 'otros'],
    quickFacts: [
      { category: 'idioma', fact: 'Devanagari (con línea horizontal superior) y decenas de escrituras según el estado.' },
      { category: 'cultura', fact: 'Auto-rickshaws, camiones Tata decorados, "HORN OK PLEASE".' },
      { category: 'meta-camara', fact: 'Mucha cobertura de cámara de generación baja y borrosa.' },
    ],
  },
  {
    code: 'lk', name: 'Sri Lanka', continent: 'asia', flag: '🇱🇰',
    driving: 'izquierda', tld: '.lk', languages: ['cingalés', 'tamil'], scripts: ['cingalés (redondo)', 'tamil'],
    quickFacts: [
      { category: 'idioma', fact: 'Escritura cingalesa: círculos y curvas sin línea superior.' },
      { category: 'cultura', fact: 'Tuk-tuks por todas partes, budismo visible.' },
      { category: 'paisaje', fact: 'Tropical denso, plantaciones de té en altura.' },
    ],
  },
  {
    code: 'bd', name: 'Bangladés', continent: 'asia', flag: '🇧🇩',
    driving: 'izquierda', tld: '.bd', languages: ['bengalí'], scripts: ['bengalí'],
    quickFacts: [
      { category: 'idioma', fact: 'Escritura bengalí: parecida a devanagari pero más angulosa y triangular.' },
      { category: 'cultura', fact: 'Rickshaws de pedal pintados, densidad humana altísima.' },
    ],
  },
  {
    code: 'bt', name: 'Bután', continent: 'asia', flag: '🇧🇹',
    driving: 'izquierda', tld: '.bt', languages: ['dzongkha'], scripts: ['tibetano'],
    quickFacts: [
      { category: 'arquitectura', fact: 'Arquitectura tradicional obligatoria: maderas pintadas, ventanas trapezoidales.' },
      { category: 'paisaje', fact: 'Montaña verde del Himalaya, carreteras serpenteantes.' },
    ],
  },
  {
    code: 'np', name: 'Nepal', continent: 'asia', flag: '🇳🇵',
    driving: 'izquierda', tld: '.np', languages: ['nepalí'], scripts: ['devanagari'],
    quickFacts: [
      { category: 'paisaje', fact: 'Himalaya, terrazas de cultivo, banderas de oración.' },
    ],
  },
  {
    code: 'th', name: 'Tailandia', continent: 'asia', flag: '🇹🇭',
    driving: 'izquierda', tld: '.th', languages: ['tailandés'], scripts: ['tailandés'],
    quickFacts: [
      { category: 'idioma', fact: 'Escritura tailandesa: círculos pequeños en el inicio de trazos, sin espacios.' },
      { category: 'cultura', fact: 'Casas de espíritus, retratos del rey, monjes de naranja.' },
      { category: 'matriculas', fact: 'Blancas con letras tailandesas arriba.' },
      { category: 'postes', fact: 'Postes de hormigón altos con marañas de cables.' },
    ],
  },
  {
    code: 'kh', name: 'Camboya', continent: 'asia', flag: '🇰🇭',
    driving: 'derecha', tld: '.kh', languages: ['jemer'], scripts: ['jemer'],
    quickFacts: [
      { category: 'idioma', fact: 'Escritura jemer: más ornamentada y "picuda" que la tailandesa.' },
      { category: 'circulacion', fact: 'Conduce por la DERECHA: separa de Tailandia al instante.' },
      { category: 'paisaje', fact: 'Llano, arrozales, carreteras polvorientas rojas.' },
    ],
  },
  {
    code: 'la', name: 'Laos', continent: 'asia', flag: '🇱🇦',
    driving: 'derecha', tld: '.la', languages: ['lao'], scripts: ['lao'],
    quickFacts: [
      { category: 'idioma', fact: 'Escritura lao: como la tailandesa pero más redondeada y con menos trazos.' },
      { category: 'circulacion', fact: 'Derecha (Tailandia va por la izquierda).' },
    ],
  },
  {
    code: 'vn', name: 'Vietnam', continent: 'asia', flag: '🇻🇳',
    driving: 'derecha', tld: '.vn', languages: ['vietnamita'], scripts: ['latino con diacríticos apilados'],
    quickFacts: [
      { category: 'idioma', fact: 'Latino con diacríticos dobles apilados (ế, ộ, ữ): inconfundible.' },
      { category: 'cultura', fact: 'Mares de motos; banderas rojas con estrella.' },
      { category: 'arquitectura', fact: '"Tube houses": casas estrechas y altas de colores.' },
    ],
  },
  {
    code: 'my', name: 'Malasia', continent: 'asia', flag: '🇲🇾',
    driving: 'izquierda', tld: '.my', languages: ['malayo', 'inglés', 'chino', 'tamil'], scripts: ['latino', 'chino', 'árabe (jawi)'],
    quickFacts: [
      { category: 'idioma', fact: '"Jalan" = calle; malayo similar al indonesio pero con más inglés alrededor.' },
      { category: 'matriculas', fact: 'NEGRAS con letras blancas.' },
      { category: 'paisaje', fact: 'Palma aceitera en plantaciones interminables.' },
    ],
  },
  {
    code: 'sg', name: 'Singapur', continent: 'asia', flag: '🇸🇬',
    driving: 'izquierda', tld: '.sg', languages: ['inglés', 'malayo', 'chino', 'tamil'], scripts: ['latino', 'chino', 'tamil'],
    quickFacts: [
      { category: 'arquitectura', fact: 'Bloques HDB de vivienda pública, orden extremo, vegetación cuidada.' },
    ],
  },
  {
    code: 'id', name: 'Indonesia', continent: 'asia', flag: '🇮🇩',
    driving: 'izquierda', tld: '.id', languages: ['indonesio'], scripts: ['latino'],
    quickFacts: [
      { category: 'idioma', fact: '"Jalan"/"Jl." = calle; palabras como "warung", "desa".' },
      { category: 'matriculas', fact: 'Tradicionalmente negras (migrando a blancas desde 2022).' },
      { category: 'arquitectura', fact: 'Tejados de teja naranja empinados, mezquitas con cúpula metálica.' },
      { category: 'cultura', fact: 'Motos omnipresentes, banderines rojos y blancos.' },
    ],
  },
  {
    code: 'ph', name: 'Filipinas', continent: 'asia', flag: '🇵🇭',
    driving: 'derecha', tld: '.ph', languages: ['filipino', 'inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'cultura', fact: 'Jeepneys y triciclos motorizados: exclusivos de Filipinas.' },
      { category: 'circulacion', fact: 'Derecha (a diferencia de Indonesia/Malasia).' },
      { category: 'idioma', fact: 'Inglés + tagalo mezclados en carteles ("Bawal", "Barangay").' },
    ],
  },
  {
    code: 'jp', name: 'Japón', continent: 'asia', flag: '🇯🇵',
    driving: 'izquierda', tld: '.jp', languages: ['japonés'], scripts: ['kanji + kana'],
    quickFacts: [
      { category: 'idioma', fact: 'Kanji con hiragana/katakana (curvas y trazos simples mezclados con caracteres complejos).' },
      { category: 'senales', fact: 'STOP: triángulo rojo invertido (止まれ).' },
      { category: 'postes', fact: 'Postes de hormigón con transformadores cilíndricos: paisaje urbano denso en cables.' },
      { category: 'circulacion', fact: 'Izquierda; calles estrechas impecables.' },
    ],
  },
  {
    code: 'kr', name: 'Corea del Sur', continent: 'asia', flag: '🇰🇷',
    driving: 'derecha', tld: '.kr', languages: ['coreano'], scripts: ['hangul'],
    quickFacts: [
      { category: 'idioma', fact: 'Hangul: bloques silábicos con círculos y líneas (ㅇ, ㅎ).' },
      { category: 'circulacion', fact: 'Derecha (Japón va por la izquierda).' },
      { category: 'paisaje', fact: 'Montes bajos y boscosos rodean valles llenos de invernaderos.' },
    ],
  },
  {
    code: 'tw', name: 'Taiwán', continent: 'asia', flag: '🇹🇼',
    driving: 'derecha', tld: '.tw', languages: ['chino mandarín'], scripts: ['chino tradicional'],
    quickFacts: [
      { category: 'idioma', fact: 'Chino tradicional (caracteres densos, sin simplificar).' },
      { category: 'cultura', fact: 'Scooters en masa, edificios con azulejos y verjas metálicas.' },
    ],
  },
  {
    code: 'hk', name: 'Hong Kong', continent: 'asia', flag: '🇭🇰',
    driving: 'izquierda', tld: '.hk', languages: ['cantonés', 'inglés'], scripts: ['chino tradicional', 'latino'],
    quickFacts: [
      { category: 'circulacion', fact: 'Chino + conducir por la IZQUIERDA + señalización británica = Hong Kong.' },
    ],
  },

  // ───────────────────────────── ÁFRICA ─────────────────────────────
  {
    code: 'za', name: 'Sudáfrica', continent: 'africa', flag: '🇿🇦',
    driving: 'izquierda', tld: '.za', languages: ['inglés', 'afrikáans', 'zulú', '+8'], scripts: ['latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Mezcla inglés/afrikáans en señales ("straat", "weg").' },
      { category: 'paisaje', fact: 'Veld dorado, fynbos en el Cabo; cercas junto a la carretera.' },
      { category: 'senales', fact: 'Numeración N (nacional) y R (regional) en señales verdes.' },
      { category: 'cultura', fact: 'Townships con chapas; contraste económico fuerte.' },
    ],
  },
  {
    code: 'ls', name: 'Lesoto', continent: 'africa', flag: '🇱🇸',
    driving: 'izquierda', tld: '.ls', languages: ['sesotho', 'inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Montañoso todo el país, altiplano de hierba; pastores con mantas.' },
      { category: 'arquitectura', fact: 'Rondavels (casas redondas de piedra con techo de paja).' },
    ],
  },
  {
    code: 'sz', name: 'Esuatini', continent: 'africa', flag: '🇸🇿',
    driving: 'izquierda', tld: '.sz', languages: ['suazi', 'inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Colinas verdes, plantaciones de caña y eucalipto.' },
    ],
  },
  {
    code: 'bw', name: 'Botsuana', continent: 'africa', flag: '🇧🇼',
    driving: 'izquierda', tld: '.bw', languages: ['setsuana', 'inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Sabana plana de arbustos (Kalahari); burros y vacas en la carretera.' },
      { category: 'lineas-viales', fact: 'Carreteras rectas infinitas con arcén arenoso.' },
    ],
  },
  {
    code: 'ke', name: 'Kenia', continent: 'africa', flag: '🇰🇪',
    driving: 'izquierda', tld: '.ke', languages: ['suajili', 'inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'meta-camara', fact: 'Snorkel (tubo) visible en el frontal del coche de Google en gran parte de la cobertura.' },
      { category: 'cultura', fact: 'Matatus (minibuses decorados), motos boda-boda.' },
      { category: 'paisaje', fact: 'Sabana, tierra roja, acacias.' },
    ],
  },
  {
    code: 'ug', name: 'Uganda', continent: 'africa', flag: '🇺🇬',
    driving: 'izquierda', tld: '.ug', languages: ['inglés', 'suajili', 'luganda'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Verde intenso, plataneras, tierra roja.' },
      { category: 'cultura', fact: 'Boda-bodas y carteles pintados a mano.' },
    ],
  },
  {
    code: 'gh', name: 'Ghana', continent: 'africa', flag: '🇬🇭',
    driving: 'derecha', tld: '.gh', languages: ['inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'circulacion', fact: 'Derecha (Kenia/Uganda van por la izquierda).' },
      { category: 'cultura', fact: 'Nombres religiosos en comercios ("God is Great Shop"); taxis con aletas pintadas.' },
      { category: 'paisaje', fact: 'Tierra roja intensa, vegetación tropical.' },
    ],
  },
  {
    code: 'ng', name: 'Nigeria', continent: 'africa', flag: '🇳🇬',
    driving: 'derecha', tld: '.ng', languages: ['inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'meta-camara', fact: 'Escolta visible en mucha cobertura (coche/policía delante o detrás).' },
      { category: 'cultura', fact: 'Keke napep (triciclos amarillos), tráfico denso.' },
    ],
  },
  {
    code: 'sn', name: 'Senegal', continent: 'africa', flag: '🇸🇳',
    driving: 'derecha', tld: '.sn', languages: ['francés', 'wolof'], scripts: ['latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Francés en señales: África Occidental francófona.' },
      { category: 'paisaje', fact: 'Sahel arenoso, baobabs, carros de caballo.' },
    ],
  },
  {
    code: 'tn', name: 'Túnez', continent: 'africa', flag: '🇹🇳',
    driving: 'derecha', tld: '.tn', languages: ['árabe', 'francés'], scripts: ['árabe', 'latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Árabe + francés juntos en señales.' },
      { category: 'arquitectura', fact: 'Casas blancas con puertas azules; olivos.' },
    ],
  },
  {
    code: 'mg', name: 'Madagascar', continent: 'africa', flag: '🇲🇬',
    driving: 'derecha', tld: '.mg', languages: ['malgache', 'francés'], scripts: ['latino'],
    quickFacts: [
      { category: 'arquitectura', fact: 'Casas altas de ladrillo rojo con balcones de madera: únicas en África.' },
      { category: 'paisaje', fact: 'Colinas deforestadas rojizas, arrozales.' },
      { category: 'meta-camara', fact: 'Mucha cobertura grabada desde la caja de una pickup.' },
    ],
  },
  {
    code: 'rw', name: 'Ruanda', continent: 'africa', flag: '🇷🇼',
    driving: 'derecha', tld: '.rw', languages: ['kinyarwanda', 'inglés', 'francés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Mil colinas: todo laderas cultivadas; limpieza notable.' },
    ],
  },

  // ─────────────────────────── AMÉRICA ───────────────────────────
  {
    code: 'us', name: 'Estados Unidos', continent: 'norteamerica', flag: '🇺🇸',
    driving: 'derecha', tld: '.us', languages: ['inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'lineas-viales', fact: 'Línea central AMARILLA, bordes blancos.' },
      { category: 'senales', fact: 'Advertencias en rombo amarillo; señales de ruta con escudos (Interstate azul-rojo).' },
      { category: 'postes', fact: 'Postes de madera con cables altos en casi todo el país.' },
      { category: 'matriculas', fact: 'Varían por estado; solo delante en muchos estados.' },
      { category: 'arquitectura', fact: 'Suburbios de casas con revestimiento vinílico y jardín sin valla.' },
    ],
  },
  {
    code: 'ca', name: 'Canadá', continent: 'norteamerica', flag: '🇨🇦',
    driving: 'derecha', tld: '.ca', languages: ['inglés', 'francés'], scripts: ['latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Bilingüe; en Quebec solo francés ("ARRÊT" en el stop).' },
      { category: 'lineas-viales', fact: 'Central amarilla como EE. UU.' },
      { category: 'paisaje', fact: 'Bosque boreal interminable; praderas en el centro.' },
    ],
  },
  {
    code: 'mx', name: 'México', continent: 'norteamerica', flag: '🇲🇽',
    driving: 'derecha', tld: '.mx', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'cultura', fact: 'Topes (badenes) señalizados, VW Beetle (vochos), colores vivos, publicidad pintada en muros.' },
      { category: 'senales', fact: '"ALTO" en el stop (en Sudamérica se usa "PARE").' },
      { category: 'paisaje', fact: 'Del desierto al trópico; agaves y matorral en el altiplano.' },
    ],
  },
  {
    code: 'gt', name: 'Guatemala', continent: 'norteamerica', flag: '🇬🇹',
    driving: 'derecha', tld: '.gt', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'cultura', fact: 'Camionetas (autobuses escolares americanos repintados de colores).' },
      { category: 'paisaje', fact: 'Volcanes, montaña verde, milpas.' },
    ],
  },
  {
    code: 'do', name: 'República Dominicana', continent: 'norteamerica', flag: '🇩🇴',
    driving: 'derecha', tld: '.do', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'cultura', fact: 'Motos por todas partes, colmados, música y colores caribeños.' },
      { category: 'paisaje', fact: 'Palmeras, caña, montañas verdes.' },
    ],
  },
  {
    code: 'pa', name: 'Panamá', continent: 'norteamerica', flag: '🇵🇦',
    driving: 'derecha', tld: '.pa', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'cultura', fact: 'Diablos rojos (buses pintados); selva + rascacielos en la capital.' },
    ],
  },
  {
    code: 'co', name: 'Colombia', continent: 'sudamerica', flag: '🇨🇴',
    driving: 'derecha', tld: '.co', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'matriculas', fact: 'Matrículas AMARILLAS: casi únicas en América.' },
      { category: 'paisaje', fact: 'Montaña verde perpetua, cafetales, niebla.' },
      { category: 'cultura', fact: 'Fachadas de colores intensos, motos.' },
    ],
  },
  {
    code: 'ec', name: 'Ecuador', continent: 'sudamerica', flag: '🇪🇨',
    driving: 'derecha', tld: '.ec', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Andes verdes, volcanes; costa con banano y cacao.' },
      { category: 'arquitectura', fact: 'Bloques de hormigón sin terminar con varillas, ladrillo visto.' },
    ],
  },
  {
    code: 'pe', name: 'Perú', continent: 'sudamerica', flag: '🇵🇪',
    driving: 'derecha', tld: '.pe', languages: ['español', 'quechua'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Costa desértica gris, sierra andina, adobe.' },
      { category: 'cultura', fact: 'Mototaxis, publicidad política pintada en muros.' },
      { category: 'arquitectura', fact: 'Adobe y ladrillo sin revocar, puertas metálicas.' },
    ],
  },
  {
    code: 'bo', name: 'Bolivia', continent: 'sudamerica', flag: '🇧🇴',
    driving: 'derecha', tld: '.bo', languages: ['español', 'quechua', 'aimara'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Altiplano a 4000 m, luz dura, cerros pelados.' },
      { category: 'arquitectura', fact: 'Ladrillo visto en El Alto; cholets de colores.' },
    ],
  },
  {
    code: 'br', name: 'Brasil', continent: 'sudamerica', flag: '🇧🇷',
    driving: 'derecha', tld: '.br', languages: ['portugués'], scripts: ['latino (ã, õ, ç)'],
    quickFacts: [
      { category: 'idioma', fact: 'Portugués (ã, õ): única lengua no española de la Sudamérica jugable grande.' },
      { category: 'matriculas', fact: 'Mercosur blancas con banda azul (antes grises).' },
      { category: 'paisaje', fact: 'Tierra roja, cerrado, caña y soja; términos "BR-XXX" en rutas.' },
      { category: 'arquitectura', fact: 'Muros con rejas y vidrio, casas de ladrillo, grafiti pixo.' },
    ],
  },
  {
    code: 'ar', name: 'Argentina', continent: 'sudamerica', flag: '🇦🇷',
    driving: 'derecha', tld: '.ar', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Pampa infinita, álamos cortavientos, Patagonia árida al sur.' },
      { category: 'matriculas', fact: 'Mercosur blancas con banda azul arriba (antes negras).' },
      { category: 'senales', fact: 'Rutas RN/RP; carteles verdes.' },
      { category: 'cultura', fact: 'Santuarios rojos del Gauchito Gil al borde de rutas.' },
    ],
  },
  {
    code: 'cl', name: 'Chile', continent: 'sudamerica', flag: '🇨🇱',
    driving: 'derecha', tld: '.cl', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Desierto de Atacama al norte, mediterráneo al centro, bosque lluvioso al sur: siempre con los Andes de fondo.' },
      { category: 'senales', fact: 'Rutas "Ruta 5" (Panamericana); señalización ordenada, país visualmente más "ordenado" que vecinos.' },
    ],
  },
  {
    code: 'uy', name: 'Uruguay', continent: 'sudamerica', flag: '🇺🇾',
    driving: 'derecha', tld: '.uy', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Praderas suaves con ganado; palmeras aisladas; sin montañas.' },
      { category: 'cultura', fact: 'Menos motos que en el resto de Latinoamérica; ambiente tranquilo.' },
    ],
  },

  // ─────────────────────────── OCEANÍA ───────────────────────────
  {
    code: 'au', name: 'Australia', continent: 'oceania', flag: '🇦🇺',
    driving: 'izquierda', tld: '.au', languages: ['inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Eucaliptos (corteza clara que pela), tierra rojiza, outback.' },
      { category: 'senales', fact: 'Advertencias en rombo amarillo; señales de canguros.' },
      { category: 'lineas-viales', fact: 'Líneas blancas; "roadtrains" y rectas enormes en el interior.' },
      { category: 'cultura', fact: 'Buzones en poste, casas de una planta con techo de chapa.' },
    ],
  },
  {
    code: 'nz', name: 'Nueva Zelanda', continent: 'oceania', flag: '🇳🇿',
    driving: 'izquierda', tld: '.nz', languages: ['inglés', 'maorí'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Verde intenso, ovejas, montañas; helechos arbóreos nativos (no eucaliptos).' },
      { category: 'toponimia', fact: 'Topónimos maoríes: Wh-, -nui, -roa (Whangārei, Rotorua).' },
      { category: 'senales', fact: 'Advertencias en rombo amarillo como Australia.' },
    ],
  },
  // ─────────── AMPLIACIÓN: territorios con guía en Plonk It ───────────
  {
    code: 'tz', name: 'Tanzania', continent: 'africa', flag: '🇹🇿',
    driving: 'izquierda', tld: '.tz', languages: ['suajili', 'inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Sabana con acacias, Kilimanjaro; tierra roja.' },
      { category: 'cultura', fact: 'Daladalas (minibuses) y bajajis; suajili dominante en carteles.' },
    ],
    coverage: 'Cobertura parcial: ciudades y rutas principales.',
  },
  {
    code: 'cr', name: 'Costa Rica', continent: 'norteamerica', flag: '🇨🇷',
    driving: 'derecha', tld: '.cr', languages: ['español'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Verde saturado, selva nubosa, volcanes.' },
      { category: 'senales', fact: '"ALTO" en el stop, como el resto de Centroamérica.' },
      { category: 'cultura', fact: 'Rejas y portones metálicos; "pura vida" en comercios.' },
    ],
  },
  {
    code: 'om', name: 'Omán', continent: 'asia', flag: '🇴🇲',
    driving: 'derecha', tld: '.om', languages: ['árabe'], scripts: ['árabe', 'latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Montañas rocosas peladas (Hajar) y desierto claro.' },
      { category: 'arquitectura', fact: 'Edificios blancos bajos con arcos y almenas; mezquitas con cúpula.' },
    ],
    coverage: 'Cobertura reciente en expansión.',
  },
  {
    code: 'pk', name: 'Pakistán', continent: 'asia', flag: '🇵🇰',
    driving: 'izquierda', tld: '.pk', languages: ['urdu', 'inglés'], scripts: ['árabe (nastaliq inclinado)', 'latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Urdu en nastaliq: escritura árabe muy inclinada y caligráfica.' },
      { category: 'cultura', fact: 'Camiones decorados hasta el último centímetro (jingle trucks).' },
    ],
    coverage: 'Cobertura limitada e irregular.',
  },
  {
    code: 'lb', name: 'Líbano', continent: 'asia', flag: '🇱🇧',
    driving: 'derecha', tld: '.lb', languages: ['árabe', 'francés'], scripts: ['árabe', 'latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Árabe + francés juntos: combinación levantina única jugable.' },
      { category: 'paisaje', fact: 'Mediterráneo montañoso, cedros, costa urbanizada.' },
    ],
  },
  {
    code: 'by', name: 'Bielorrusia', continent: 'europa', flag: '🇧🇾',
    driving: 'derecha', tld: '.by', languages: ['bielorruso', 'ruso'], scripts: ['cirílico (ў, і)'],
    quickFacts: [
      { category: 'idioma', fact: 'La ў (u breve) es exclusiva del bielorruso; también usa і como el ucraniano.' },
    ],
    coverage: 'Sin cobertura oficial de coche: casi todo photospheres.',
  },
  {
    code: 'eg', name: 'Egipto', continent: 'africa', flag: '🇪🇬',
    driving: 'derecha', tld: '.eg', languages: ['árabe'], scripts: ['árabe'],
    quickFacts: [
      { category: 'paisaje', fact: 'Desierto, palmerales del Nilo, ladrillo sin terminar.' },
    ],
    coverage: 'Cobertura oficial muy limitada (trekker en monumentos y poco más).',
  },
  {
    code: 'iq', name: 'Irak', continent: 'asia', flag: '🇮🇶',
    driving: 'derecha', tld: '.iq', languages: ['árabe', 'kurdo'], scripts: ['árabe'],
    quickFacts: [
      { category: 'paisaje', fact: 'Llanura árida; verde solo junto a Tigris/Éufrates; Kurdistán montañoso.' },
    ],
    coverage: 'Cobertura limitada.',
  },
  {
    code: 'ad', name: 'Andorra', continent: 'europa', flag: '🇦🇩',
    driving: 'derecha', tld: '.ad', languages: ['catalán'], scripts: ['latino'],
    quickFacts: [
      { category: 'idioma', fact: 'Catalán oficial único: "Avinguda", "Carrer".' },
      { category: 'paisaje', fact: 'Valles pirenaicos con comercios de electrónica y tabaco.' },
    ],
  },
  {
    code: 'mc', name: 'Mónaco', continent: 'europa', flag: '🇲🇨',
    driving: 'derecha', tld: '.mc', languages: ['francés'], scripts: ['latino'],
    quickFacts: [
      { category: 'arquitectura', fact: 'Rascacielos apilados sobre el puerto, túneles, yates.' },
    ],
  },
  {
    code: 'li', name: 'Liechtenstein', continent: 'europa', flag: '🇱🇮',
    driving: 'derecha', tld: '.li', languages: ['alemán'], scripts: ['latino'],
    quickFacts: [
      { category: 'matriculas', fact: 'Matrículas NEGRAS con texto blanco y "FL": únicas en la región alpina.' },
    ],
  },
  {
    code: 'sm', name: 'San Marino', continent: 'europa', flag: '🇸🇲',
    driving: 'derecha', tld: '.sm', languages: ['italiano'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Monte Titano con tres torres; Italia alrededor.' },
    ],
  },
  {
    code: 'fo', name: 'Islas Feroe', continent: 'europa', flag: '🇫🇴',
    driving: 'derecha', tld: '.fo', languages: ['feroés', 'danés'], scripts: ['latino (ð, sin þ)'],
    quickFacts: [
      { category: 'paisaje', fact: 'Hierba hasta el mar, sin árboles, ovejas por doquier, techos verdes.' },
      { category: 'idioma', fact: 'Feroés: usa ð pero NO þ (eso sería Islandia).' },
    ],
  },
  {
    code: 'gl', name: 'Groenlandia', continent: 'norteamerica', flag: '🇬🇱',
    driving: 'derecha', tld: '.gl', languages: ['groenlandés', 'danés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Casas de colores sobre roca, icebergs; no hay carreteras entre ciudades.' },
    ],
    coverage: 'Cobertura limitada a algunas poblaciones.',
  },
  {
    code: 'im', name: 'Isla de Man', continent: 'europa', flag: '🇮🇲',
    driving: 'izquierda', tld: '.im', languages: ['inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'cultura', fact: 'Estética británica con triskelion (tres piernas) en banderas y escudos.' },
    ],
  },
  {
    code: 'je', name: 'Jersey', continent: 'europa', flag: '🇯🇪',
    driving: 'izquierda', tld: '.je', languages: ['inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'arquitectura', fact: 'Granito rosado, setos altos, estética británica con topónimos franceses.' },
    ],
  },
  {
    code: 'cw', name: 'Curazao', continent: 'sudamerica', flag: '🇨🇼',
    driving: 'derecha', tld: '.cw', languages: ['neerlandés', 'papiamento'], scripts: ['latino'],
    quickFacts: [
      { category: 'arquitectura', fact: 'Casas coloniales holandesas pintadas de colores caribeños.' },
    ],
  },
  {
    code: 'mq', name: 'Martinica', continent: 'norteamerica', flag: '🇲🇶',
    driving: 'derecha', tld: '.mq', languages: ['francés'], scripts: ['latino'],
    quickFacts: [
      { category: 'senales', fact: 'Francia tropical: señalización y bolardos franceses entre caña y palmeras.' },
    ],
  },
  {
    code: 're', name: 'Reunión', continent: 'africa', flag: '🇷🇪',
    driving: 'derecha', tld: '.re', languages: ['francés'], scripts: ['latino'],
    quickFacts: [
      { category: 'paisaje', fact: 'Volcán activo y montañas abruptas; carreteras francesas impecables en el Índico.' },
    ],
  },
  {
    code: 'pr', name: 'Puerto Rico', continent: 'norteamerica', flag: '🇵🇷',
    driving: 'derecha', tld: '.pr', languages: ['español', 'inglés'], scripts: ['latino'],
    quickFacts: [
      { category: 'senales', fact: 'Señalización estilo EE. UU. pero en español ("PARE", "SALIDA").' },
      { category: 'lineas-viales', fact: 'Central amarilla y rombos de advertencia americanos.' },
    ],
  },
  {
    code: 'vu', name: 'Vanuatu', continent: 'oceania', flag: '🇻🇺',
    driving: 'derecha', tld: '.vu', languages: ['bislama', 'inglés', 'francés'], scripts: ['latino'],
    quickFacts: [
      { category: 'circulacion', fact: 'Conduce por la DERECHA, raro en Oceanía (Australia/NZ van por la izquierda).' },
    ],
    coverage: 'Cobertura limitada.',
  },
  {
    code: 'mo', name: 'Macao', continent: 'asia', flag: '🇲🇴',
    driving: 'izquierda', tld: '.mo', languages: ['cantonés', 'portugués'], scripts: ['chino tradicional', 'latino'],
    quickFacts: [
      { category: 'toponimia', fact: 'Calles en portugués ("Rua", "Avenida") junto a chino tradicional: combinación única.' },
      { category: 'cultura', fact: 'Casinos gigantes y calzada portuguesa de adoquín.' },
    ],
  },
]

export const COUNTRY_MAP = new Map(COUNTRIES.map((c) => [c.code, c]))

export const CONTINENTS: { id: string; name: string }[] = [
  { id: 'europa', name: 'Europa' },
  { id: 'asia', name: 'Asia' },
  { id: 'africa', name: 'África' },
  { id: 'norteamerica', name: 'Norteamérica' },
  { id: 'sudamerica', name: 'Sudamérica' },
  { id: 'oceania', name: 'Oceanía' },
]

export function countryName(code: string): string {
  return COUNTRY_MAP.get(code)?.name ?? code.toUpperCase()
}

export function countryFlag(code: string): string {
  return COUNTRY_MAP.get(code)?.flag ?? '🏳️'
}
