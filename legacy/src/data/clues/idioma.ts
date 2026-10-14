import type { Clue } from '../types'

const V = '2026-10-11'
const PLONKIT = { name: 'Plonk It · Guía de principiantes', url: 'https://www.plonkit.net/beginners-guide' }

export const CLUES_IDIOMA: Clue[] = [
  {
    id: 'espanol-ene',
    name: 'La ñ y el español',
    category: 'idioma',
    countries: ['es', 'mx', 'ar', 'cl', 'co', 'pe', 'uy', 'ec', 'bo', 'gt', 'do', 'pa'],
    visual: 'La letra ñ en carteles ("señal", "año", "pequeño"); signos ¿ ¡.',
    lookFor: 'ñ confirma español; para saber QUÉ país hispano, pasa a otras pistas (relieve, matrículas, ALTO/PARE).',
    howToUse:
      'Español en Europa → España. En América, la ñ solo abre la pregunta: decide con paisaje, placas y arquitectura.',
    confidence: 'fuerte',
    related: ['alto-vs-pare', 'espana-vs-portugal-idioma'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'portugues-tildes',
    name: 'ã y õ: portugués',
    category: 'idioma',
    countries: ['pt', 'br'],
    visual: 'Vocales con tilde nasal: "São", "não", "informação"; también ç y -ção.',
    lookFor: 'La ~ sobre A u O no existe en español: es el delator portugués.',
    howToUse:
      'ã/õ en Europa → Portugal; en América → Brasil. Entre ambos: Brasil tiene tierra roja, rejas y PARE; Portugal, azulejos y calzada de adoquín.',
    confidence: 'fuerte',
    related: ['espana-vs-portugal-idioma', 'matricula-mercosur'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'espana-vs-portugal-idioma',
    name: 'Separar España de Portugal por los carteles',
    category: 'idioma',
    countries: ['es', 'pt'],
    visual: 'Lenguas hermanas en señalización parecida.',
    lookFor:
      'Portugal: ã/õ, "Rua", -ção. España: ñ, "Calle", -ción. Gallego (noroeste de España) se parece al portugués: mira matrículas y numeración de carretera (N- en ambos, pero A-/AP- es español).',
    howToUse: 'Una palabra basta: Rua vs Calle. Si solo hay topónimos, busca la ñ o la ã.',
    confidence: 'fuerte',
    exceptions: ['En Galicia verás "Rúa": comprueba otra pista antes de saltar a Portugal.'],
    related: ['portugues-tildes', 'espanol-ene', 'azulejos-portugal'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'dano-noruego-vs-sueco',
    name: 'ø/æ contra ö/ä: partir Escandinavia',
    category: 'idioma',
    countries: ['dk', 'no', 'se'],
    visual: 'Vocales especiales en carteles nórdicos.',
    lookFor:
      'ø y æ → danés o noruego. ö y ä → sueco (y finlandés). Para separar danés de noruego: "vej" = Dinamarca, "vei/veg" = Noruega.',
    howToUse:
      'Una sola vocal en un topónimo reduce tres países a uno o dos. Combínala con líneas (amarilla = Noruega) y señales (blancas = Dinamarca).',
    confidence: 'fuerte',
    related: ['nordicos-linea-central', 'advertencia-amarilla-nordica', 'fines-estonio'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'fines-estonio',
    name: 'Finés vs estonio: la õ decide',
    category: 'idioma',
    countries: ['fi', 'ee'],
    visual:
      'Palabras largas con vocales dobles (aa, ii, uu) y ä/ö en ambas lenguas.',
    lookFor:
      'La letra õ existe en ESTONIO y no en finés. "tie/katu" (carretera/calle) = Finlandia; "maantee/tänav" = Estonia. Finlandia costera añade sueco en señales.',
    howToUse:
      'Paisaje boreal + vocales dobles = una de las dos; busca õ o los sufijos de calle para decidir.',
    confidence: 'fuerte',
    related: ['dano-noruego-vs-sueco', 'letonia-macrones'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'islandes-letras',
    name: 'þ y ð: Islandia',
    category: 'idioma',
    countries: ['is'],
    visual: 'Las letras þ (thorn) y ð (eth) en topónimos: "Þingvellir", "Seyðisfjörður".',
    lookFor: 'Cualquiera de las dos letras basta; no existen en otras lenguas viales.',
    howToUse: 'þ o ð vistas → Islandia, sin más confirmación necesaria.',
    confidence: 'fuerte',
    related: ['linea-central-amarilla', 'islandia-sin-arboles'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'polaco-letra-l',
    name: 'ł: la firma del polaco',
    category: 'idioma',
    countries: ['pl'],
    visual: 'La L tachada (ł) más ą, ę, ż, ś, ć en carteles.',
    lookFor: 'ł es casi exclusiva del polaco; también la pareja rz y "ul." antes de calles.',
    howToUse: 'ł vista → Polonia. Es de las letras más rentables de Europa.',
    confidence: 'fuerte',
    related: ['ul-polonia', 'advertencia-amarilla-nordica'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'checo-vs-eslovaco',
    name: 'Checo vs eslovaco: ř contra ľ',
    category: 'idioma',
    countries: ['cz', 'sk'],
    visual: 'Lenguas casi gemelas con háčeks (č, š, ž).',
    lookFor:
      'ř y ů → SOLO checo. ľ, ĺ, ŕ y ô → SOLO eslovaco. Con una de estas letras la duda desaparece.',
    howToUse:
      'Si no encuentras letra decisiva: Tatras y pueblos-calle → Eslovaquia; Bohemia ondulada → Chequia; el bolardo es igual en ambos.',
    confidence: 'fuerte',
    related: ['bolardo-checo-eslovaco'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'hungaro-doble-acento',
    name: 'ő y ű: húngaro',
    category: 'idioma',
    countries: ['hu'],
    visual: 'Doble acento agudo sobre o/u: ő, ű ("Győr", "fűtés").',
    lookFor: 'El doble acento no existe en ninguna otra lengua europea; "utca" (calle) lo confirma.',
    howToUse: 'ő/ű o "utca" → Hungría directamente.',
    confidence: 'fuerte',
    related: ['postes-hungria', 'utca-hungria'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'rumano-comas',
    name: 'ș y ț: rumano',
    category: 'idioma',
    countries: ['ro'],
    visual: 'S y T con coma debajo (ș, ț) + ă, â, î: "Bucureşti", "județ", "stradă".',
    lookFor:
      'Lengua de aspecto romance (parecida al italiano/español) pero con ă y comas: es rumano.',
    howToUse:
      'Romance + ă → Rumanía (Moldavia comparte lengua pero apenas tiene cobertura clásica).',
    confidence: 'fuerte',
    related: ['carros-rumania'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'turco-letras',
    name: 'ı sin punto, ğ y ş: turco',
    category: 'idioma',
    countries: ['tr'],
    visual: 'La ı SIN punto ("Diyarbakır"), ğ suave y ş: "Çarşı", "Dağ".',
    lookFor: 'La i sin punto en mayúscula/minúscula es inconfundible; palabras largas aglutinadas.',
    howToUse: 'ı/ğ/ş → Turquía (Azerbaiyán es similar pero sin cobertura estándar).',
    confidence: 'fuerte',
    related: ['turquia-banderas'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'cirilico-ruso-vs-ucraniano',
    name: 'Cirílico: ruso vs ucraniano',
    category: 'idioma',
    countries: ['ru', 'ua'],
    visual: 'Carteles en cirílico de aspecto similar.',
    lookFor:
      'і, ї, є (con punto, con diéresis) → UCRANIANO. ы, ё, ъ frecuente → RUSO. "вулиця" (vulytsia) = calle ucraniana; "улица" (ulitsa) = rusa.',
    howToUse:
      'Busca una i latina en medio del cirílico: es el atajo ucraniano. Sin letras decisivas, usa dominio (.ua/.ru) en anuncios o matrículas.',
    confidence: 'fuerte',
    related: ['bolardo-ruso', 'estepa-girasol-ucrania'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'cirilico-bulgaro-serbio',
    name: 'Cirílico balcánico: búlgaro y serbio',
    category: 'idioma',
    countries: ['bg', 'rs', 'mk'],
    visual: 'Cirílico en los Balcanes, a menudo junto a latino.',
    lookFor:
      'ъ en medio de palabras ("България") → búlgaro. ћ, ђ, џ, љ, њ → serbio. ѓ, ќ → macedonio. Serbia alterna cirílico y latino en la misma calle.',
    howToUse:
      'Cirílico + teja árabe mediterránea = Balcanes, no Rusia. Después aplica las letras diagnósticas.',
    confidence: 'fuerte',
    related: ['cirilico-ruso-vs-ucraniano'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'cirilico-kazajo',
    name: 'Cirílico con letras extra: Asia Central y Mongolia',
    category: 'idioma',
    countries: ['kz', 'kg', 'mn'],
    visual: 'Cirílico con caracteres adicionales: ә, ғ, қ, ң, ө, ұ, ү.',
    lookFor:
      'ә/қ/ұ → kazajo. ө/ү sin las otras → kirguís o mongol. Mongolia: estepa sin vallas y gers; Kirguistán: montañas enormes.',
    howToUse:
      'Cirílico "raro" + paisaje árido continental → Asia Central/Mongolia, no Rusia europea.',
    confidence: 'fuerte',
    related: ['estepa-mongolia', 'postes-exsovieticos'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'griego-alfabeto',
    name: 'Alfabeto griego',
    category: 'idioma',
    countries: ['gr', 'cy'],
    visual: 'Σ, Δ, Ω, Φ, Λ en carteles; señales viales bilingües griego/latino.',
    lookFor: 'Letras griegas inconfundibles; topónimos con -os, -i.',
    howToUse:
      'Griego + conducir por la DERECHA → Grecia. Griego + IZQUIERDA → Chipre. Ese es todo el truco.',
    confidence: 'fuerte',
    related: ['izquierda-mundo'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'georgiano-armenio',
    name: 'Georgiano y armenio: alfabetos únicos',
    category: 'idioma',
    countries: [],
    visual:
      'Georgiano (ქართული): letras redondas con colas, parecen uvas o anzuelos. Armenio (Հայերեն): letras angulosas con ganchos, aspecto "de runa suave".',
    lookFor:
      'Ninguno se parece a cirílico ni a latino: una palabra basta para fijar el país.',
    howToUse:
      'Curvas y círculos → Georgia. Ángulos con astas → Armenia. Ambos países del Cáucaso tienen cobertura jugable.',
    confidence: 'fuerte',
    related: ['cirilico-kazajo'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'hebreo-vs-arabe',
    name: 'Hebreo vs árabe de un vistazo',
    category: 'idioma',
    countries: ['il', 'jo', 'ae', 'qa', 'tn'],
    visual:
      'Hebreo: letras CUADRADAS, separadas, sin ligaduras (א ב ש). Árabe: trazo CURSIVO continuo con puntos arriba/abajo (ـعـربـي).',
    lookFor:
      'El hebreo parece bloques; el árabe parece ondas enlazadas. Ambos se leen de derecha a izquierda.',
    howToUse:
      'Hebreo → Israel. Árabe: usa el segundo idioma del cartel (francés → Magreb/Túnez; inglés → Golfo/Jordania) para elegir país.',
    confidence: 'fuerte',
    related: ['senales-bilingues'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'tailandes-lao-jemer-birmano',
    name: 'Cuatro escrituras del Sudeste Asiático',
    category: 'idioma',
    countries: ['th', 'la', 'kh'],
    visual:
      'Tailandés: trazos con circulitos de inicio, sin espacios entre palabras. Lao: como el tailandés pero más redondeado y simple. Jemer (Camboya): más alto, picudo y ornamentado, con apilamientos. Birmano: círculos casi perfectos encadenados.',
    lookFor:
      'Pregúntate: ¿circulitos pequeños (tai), curvas limpias (lao), picos apilados (jemer) o círculos completos (birmano)?',
    howToUse:
      'La escritura + el sentido de circulación (Tailandia izquierda; Laos/Camboya derecha) resuelven la región en dos pasos.',
    confidence: 'fuerte',
    related: ['vecinos-sentido-opuesto', 'casas-espiritus'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'vietnamita-diacriticos',
    name: 'Vietnamita: diacríticos apilados',
    category: 'idioma',
    countries: ['vn'],
    visual:
      'Alfabeto latino con DOS marcas por vocal: ế, ở, ữ, ậ ("Phố", "Nguyễn").',
    lookFor: 'El apilamiento de tildes es único en el mundo; palabras cortas monosilábicas.',
    howToUse: 'Diacríticos dobles → Vietnam, sin dudar.',
    confidence: 'fuerte',
    related: ['motos-vietnam', 'postes-tropicos-hormigon'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'devanagari-vs-bengali',
    name: 'Devanagari, bengalí y cingalés',
    category: 'idioma',
    countries: ['in', 'np', 'bd', 'lk'],
    visual:
      'Devanagari (India/Nepal): línea horizontal continua arriba de la palabra. Bengalí: parecida pero más angulosa, con triángulos. Cingalés (Sri Lanka): todo curvas y espirales, sin línea superior.',
    lookFor:
      'La línea superior delata devanagari; su ausencia + redondez = cingalés; ángulos con ganchos = bengalí.',
    howToUse:
      'Asigna la escritura y luego decide: India (caos vial, rickshaws), Nepal (montaña), Bangladés (densidad, rickshaws de pedal), Sri Lanka (tuk-tuks, trópico).',
    confidence: 'fuerte',
    related: ['rickshaws-por-pais', 'matricula-india-comercial'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'japones-vs-coreano-vs-chino',
    name: 'Japonés, coreano y chino de un vistazo',
    category: 'idioma',
    countries: ['jp', 'kr', 'tw', 'hk'],
    visual:
      'Japonés: mezcla de caracteres complejos (kanji) con sílabas simples y curvas (の, し, て). Coreano: bloques con círculos y palos (한국). Chino: TODO caracteres densos, sin sílabas simples.',
    lookFor:
      'Busca círculos: hangul los tiene siempre (ㅇ); el hiragana tiene curvas sueltas; el chino no tiene ni unos ni otras.',
    howToUse:
      'Kana → Japón. Hangul → Corea. Solo hanzi → Taiwán/Hong Kong (tradicional). Hong Kong además conduce por la izquierda.',
    confidence: 'fuerte',
    related: ['stop-japon-triangulo', 'izquierda-mundo'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
  {
    id: 'indonesia-vs-malasia',
    name: 'Indonesio vs malayo: gemelos con matices',
    category: 'idioma',
    countries: ['id', 'my'],
    visual: 'Misma familia lingüística, carteles muy parecidos ("Jalan", "Selamat datang").',
    lookFor:
      'Malasia mezcla más inglés y a veces jawi (árabe); Indonesia usa "desa", "warung", "kabupaten". Matrículas negras en ambos (Indonesia migrando a blancas).',
    howToUse:
      'No fuerces la lengua: decide con el entorno (plantaciones ordenadas de palma y autopistas → Malasia; densidad, warungs, techos naranjas → Indonesia).',
    confidence: 'moderada',
    related: ['jalan-sudeste', 'matricula-malasia-indonesia'],
    sources: [PLONKIT],
    verifiedAt: V,
  },
]
