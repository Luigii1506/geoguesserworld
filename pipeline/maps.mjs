// Capas de mapas temáticos (public/community/maps.json): un rasgo de la meta
// por capa y su valor en cada país, para pintarlos en el mapa mundial.
//
// Fuentes: la base global de países (lado de conducción, idiomas → escritura),
// los atributos de GeoHints (líneas, cámaras, años, nieve) y los objetos de
// meta extraídos con DeepSeek (variante principal y nacional de cada objeto).
// Un país puede tener varios valores en una capa (p. ej. Serbia: latina y cirílica).

// [id, grupo, título, pregunta, tipo de objeto, rasgo, ¿es un color?]
const TRAIT_LAYERS = [
  ['center_line', 'Carretera', 'Línea central', '¿De qué color es la línea del centro?', 'road_lines', 'center_line_color', true],
  ['outer_line', 'Carretera', 'Línea exterior', '¿De qué color son las líneas del borde?', 'road_lines', 'outer_line_color', true],
  ['center_style', 'Carretera', 'Estilo de la línea central', '¿Continua, discontinua o doble?', 'road_lines', 'center_line_style', false],
  ['bollard_body', 'Bolardos', 'Color del bolardo', '¿De qué color es el cuerpo del bolardo?', 'bollard', 'body_color', true],
  ['bollard_mark', 'Bolardos', 'Marca del bolardo', '¿De qué color es la banda o marca?', 'bollard', 'marking_color', true],
  ['bollard_reflector', 'Bolardos', 'Reflector delantero', '¿De qué color es el reflector que ves de frente?', 'bollard', 'front_reflector_color', true],
  ['bollard_shape', 'Bolardos', 'Forma del bolardo', '¿Redondo, triangular, plano…?', 'bollard', 'shape', false],
  ['plate_front', 'Matrículas', 'Matrícula delantera', '¿De qué color es la matrícula de delante?', 'licence_plate', 'front_color', true],
  ['plate_rear', 'Matrículas', 'Matrícula trasera', '¿De qué color es la matrícula de detrás?', 'licence_plate', 'rear_color', true],
  ['plate_strip', 'Matrículas', 'Franja lateral', '¿Lleva franja a la izquierda (azul UE…)?', 'licence_plate', 'side_strip', false],
  ['plate_shape', 'Matrículas', 'Forma de la matrícula', '¿Alargada o corta?', 'licence_plate', 'shape', false],
  ['chevron', 'Señales', 'Chevrones', '¿De qué color es el fondo del chevrón?', 'chevron', 'background_color', true],
  ['warning_bg', 'Señales', 'Señal de advertencia', '¿Fondo blanco o amarillo?', 'warning_sign', 'background_color', true],
  ['warning_shape', 'Señales', 'Forma de la advertencia', '¿Triángulo o rombo?', 'warning_sign', 'shape', false],
  ['stop_text', 'Señales', 'Texto del stop', '¿STOP, PARE o ALTO?', 'stop_sign', 'text', false],
  ['sign_back', 'Señales', 'Trasera de las señales', '¿De qué color es la parte de atrás de las señales?', 'sign_back', 'back_color', true],
  ['pole_material', 'Postes', 'Material de los postes', '¿Madera, hormigón o metal?', 'utility_pole', 'material', false],
  ['car_color', 'Coche de Google', 'Color del coche', '¿De qué color es el coche de Google?', 'google_car', 'car_color', true],
  ['car_type', 'Coche de Google', 'Vehículo', '¿Coche, pickup, trekker…?', 'google_car', 'vehicle_type', false],
  ['car_antenna', 'Coche de Google', 'Antena', '¿Se ve la antena del coche?', 'google_car', 'antenna', false],
]

// GeoHints "lines": combinación exterior | central
const LINES = {
  'Outside: White | Inside: White': { v: 'white_white', label: 'Bordes blancos · centro blanco', color: '#f5f3ec' },
  'Outside: White | Inside: Yellow': { v: 'white_yellow', label: 'Bordes blancos · centro amarillo', color: '#f2c230' },
  'Outside: White | Inside: White and yellow': { v: 'white_mixed', label: 'Bordes blancos · centro blanco y amarillo', color: '#f7e19a' },
  'Outside: Yellow | Inside: White': { v: 'yellow_white', label: 'Bordes amarillos · centro blanco', color: '#e8862b' },
  'Outside: Yellow | Inside: Yellow': { v: 'yellow_yellow', label: 'Bordes amarillos · centro amarillo', color: '#a8740f' },
}

// idioma (nombre en inglés de mledoze) → escritura que se ve en las señales; por defecto latina
const SCRIPT = {
  Russian: 'cyrillic', Ukrainian: 'cyrillic', Belarusian: 'cyrillic', Bulgarian: 'cyrillic', Serbian: 'cyrillic',
  Macedonian: 'cyrillic', Kazakh: 'cyrillic', Kyrgyz: 'cyrillic', Mongolian: 'cyrillic', Tajik: 'cyrillic',
  Arabic: 'arabic', Persian: 'arabic', 'Persian (Farsi)': 'arabic', Urdu: 'arabic', Pashto: 'arabic', Dari: 'arabic',
  Hebrew: 'hebrew', Greek: 'greek', Georgian: 'georgian', Armenian: 'armenian',
  Thai: 'thai', Lao: 'lao', Khmer: 'khmer', Burmese: 'burmese', Sinhala: 'sinhala', Tamil: 'tamil',
  Hindi: 'devanagari', Nepali: 'devanagari', Bengali: 'bengali', Japanese: 'japanese', Korean: 'hangul',
  Chinese: 'chinese', Amharic: 'geez', Tigrinya: 'geez', Dhivehi: 'thaana', Dzongkha: 'tibetan',
}
const SCRIPT_LABEL = {
  latin: 'Latina', cyrillic: 'Cirílica', arabic: 'Árabe', hebrew: 'Hebrea', greek: 'Griega', georgian: 'Georgiana',
  armenian: 'Armenia', thai: 'Tailandesa', lao: 'Lao', khmer: 'Jemer', burmese: 'Birmana', sinhala: 'Cingalesa',
  tamil: 'Tamil', devanagari: 'Devanagari', bengali: 'Bengalí', japanese: 'Japonesa', hangul: 'Coreana (hangul)',
  chinese: 'China', geez: 'Ge’ez (etíope)', thaana: 'Thaana', tibetan: 'Tibetana',
}

const CAMERA_ORDER = ['Gen 1', 'Gen 2', 'Gen 3', 'Gen 4', 'Small Cam', 'Low Cam', 'Bad Cam']

/** Construye las capas; `countries` son las filas exportadas (con code, driving_side, languages). */
export function buildMaps(db, countries) {
  const layers = []
  const push = (layer, byCountry, order) => {
    const data = {}
    const count = new Map()
    for (const [cc, vals] of byCountry) {
      const list = [...new Set(vals)].filter(Boolean)
      if (!list.length) continue
      data[cc] = list
      for (const v of list) count.set(v, (count.get(v) ?? 0) + 1)
    }
    const meta = new Map((layer.values ?? []).map((x) => [x.v, x]))
    const values = (order ?? [...count.keys()].sort((a, b) => count.get(b) - count.get(a)))
      .filter((v) => count.has(v))
      .map((v) => ({ ...meta.get(v), v, n: count.get(v) }))
    layers.push({ ...layer, values, data, total: Object.keys(data).length })
  }

  // ── conducción ──
  push(
    { id: 'driving', group: 'Conducción', title: 'Lado de conducción', question: '¿Por qué lado circulan?', kind: 'cat',
      values: [{ v: 'right', label: 'Derecha', color: '#2f62b8' }, { v: 'left', label: 'Izquierda', color: '#e8862b' }] },
    new Map(countries.filter((c) => c.driving_side).map((c) => [c.code, [c.driving_side]])),
    ['right', 'left'],
  )

  // ── escritura ──
  push(
    { id: 'script', group: 'Idioma', title: 'Escritura', question: '¿Qué alfabeto verás en las señales?', kind: 'cat', multi: true,
      values: Object.entries(SCRIPT_LABEL).map(([v, label]) => ({ v, label })) },
    new Map(countries.map((c) => [c.code, (c.languages ?? []).map((l) => SCRIPT[l] ?? 'latin')])),
  )

  // ── GeoHints ──
  const attr = (name) => {
    const m = new Map()
    for (const r of db.prepare('SELECT country_code cc, value FROM attributes WHERE attribute = ? AND country_code IS NOT NULL').all(name)) {
      if (!m.has(r.cc)) m.set(r.cc, [])
      m.get(r.cc).push(r.value)
    }
    return m
  }
  const lines = attr('lines')
  push(
    { id: 'lines', group: 'Carretera', title: 'Líneas viales', question: '¿Cómo son los bordes y el centro de la carretera?', kind: 'cat', multi: true,
      values: Object.values(LINES), source: 'GeoHints' },
    new Map([...lines].map(([cc, vals]) => [cc, vals.map((v) => LINES[v]?.v)])),
  )
  const gens = attr('cameraGens')
  push(
    { id: 'camera', group: 'Cobertura', title: 'Generaciones de cámara', question: '¿Qué cámaras han pasado por el país?', kind: 'cat', multi: true,
      values: CAMERA_ORDER.map((v) => ({ v })), source: 'GeoHints' },
    new Map([...gens].map(([cc, vals]) => [cc, vals.filter((v) => CAMERA_ORDER.includes(v))])),
    CAMERA_ORDER,
  )
  const years = attr('years')
  const bucket = (y) => (y <= 2010 ? '≤2010' : y <= 2014 ? '2011-2014' : y <= 2018 ? '2015-2018' : '2019+')
  push(
    { id: 'first', group: 'Cobertura', title: 'Primera cobertura', question: '¿Desde cuándo hay Street View?', kind: 'cat', source: 'GeoHints',
      values: [
        { v: '≤2010', label: '2010 o antes', color: '#1f4f8a' },
        { v: '2011-2014', label: '2011–2014', color: '#4f8fc0' },
        { v: '2015-2018', label: '2015–2018', color: '#9cc3a0' },
        { v: '2019+', label: '2019 o después', color: '#e8862b' },
      ] },
    new Map([...years].map(([cc, vals]) => [cc, [bucket(Math.min(...vals.map(Number)))]])),
    ['≤2010', '2011-2014', '2015-2018', '2019+'],
  )
  // GeoHints solo lista los países con nieve: el resto de países con cobertura, sin nieve
  const snow = attr('snow')
  const covered = countries.filter((c) => c.groups > 0).map((c) => c.code)
  push(
    { id: 'snow', group: 'Cobertura', title: 'Nieve', question: '¿Puede aparecer nieve en la cobertura?', kind: 'cat', source: 'GeoHints',
      values: [
        { v: 'snow', label: 'Con nieve', color: '#2f62b8' },
        { v: 'no_snow', label: 'Sin nieve', color: '#e2c48f' },
      ] },
    new Map(covered.map((cc) => [cc, [snow.has(cc) ? 'snow' : 'no_snow']])),
    ['snow', 'no_snow'],
  )

  // ── objetos de meta ──
  const traitStmt = db.prepare(`SELECT o.country_code cc, t.value FROM object_traits t JOIN meta_objects o ON o.id = t.object_id
    WHERE o.type = ? AND t.key = ? AND o.variant = 'main' AND o.region IS NULL AND t.value NOT IN ('other', 'unknown')`)
  for (const [id, group, title, question, type, key, isColor] of TRAIT_LAYERS) {
    const m = new Map()
    for (const r of traitStmt.all(type, key)) {
      if (!m.has(r.cc)) m.set(r.cc, [])
      m.get(r.cc).push(r.value)
    }
    push({ id, group, title, question, kind: isColor ? 'color' : 'cat', multi: true, source: 'Objetos de meta' }, m)
  }

  return layers.filter((l) => l.total >= 10)
}
