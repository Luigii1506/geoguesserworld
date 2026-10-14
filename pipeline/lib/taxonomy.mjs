// Taxonomía única para todas las fuentes. Cada fuente etiqueta a su manera
// ("Bollard:", "bollard", "Bollards", "signs/stop", "Electricity poles"...);
// aquí se traduce todo a un id canónico + subcategoría opcional.
//
// Orden de clasificación: etiqueta de sección → tags de la fuente → palabras
// clave del texto. Se registra el método usado (category_method) para poder
// auditar y mejorar las reglas.

export const CATEGORIES = [
  // id, nombre visible, grupo
  ['general', 'Visión general', 'Panorama'],
  ['regions', 'Regiones y subdivisiones', 'Panorama'],
  ['google_car', 'Coche de Google', 'Meta de cobertura'],
  ['camera', 'Generación de cámara', 'Meta de cobertura'],
  ['coverage', 'Cobertura', 'Meta de cobertura'],
  ['road_lines', 'Líneas viales', 'Carretera'],
  ['bollards', 'Bolardos', 'Carretera'],
  ['guardrails', 'Guardarraíles', 'Carretera'],
  ['signs', 'Señales', 'Carretera'],
  ['road_numbering', 'Numeración de carreteras', 'Carretera'],
  ['milestones', 'Hitos kilométricos', 'Carretera'],
  ['road_surface', 'Firme y arcenes', 'Carretera'],
  ['driving_side', 'Sentido de circulación', 'Carretera'],
  ['plates', 'Matrículas', 'Vehículos'],
  ['vehicles', 'Vehículos', 'Vehículos'],
  ['poles', 'Postes', 'Infraestructura'],
  ['street_furniture', 'Mobiliario urbano', 'Infraestructura'],
  ['language', 'Idioma y escritura', 'Idioma'],
  ['naming', 'Nombres de calles y lugares', 'Idioma'],
  ['domain', 'Dominio web', 'Datos'],
  ['phone', 'Prefijos telefónicos', 'Datos'],
  ['flag', 'Bandera', 'Datos'],
  ['currency', 'Moneda', 'Datos'],
  ['architecture', 'Arquitectura', 'Entorno'],
  ['landscape', 'Paisaje y vegetación', 'Entorno'],
  ['sun', 'Sol y latitud', 'Entorno'],
  ['culture', 'Cultura y comercios', 'Entorno'],
  ['landmarks', 'Lugares reconocibles', 'Entorno'],
  ['other', 'Otros', 'Otros'],
]

// [regex, categoría, subcategoría?] — se prueban en orden; gana la primera.
const LABEL_RULES = [
  [/most helpful|identif|overview|general look|strateg|basics|summary|introduc/i, 'general'],
  [/subdivision|region|state|province|county|district|area code|oblast|prefecture/i, 'regions'],
  [/google ?car|follow ?car|\bcar\b|snorkel|antenna|google ?vehicle|trekker|boat|snowmobile|motorcycle|train|animals?$/i, 'google_car'],
  [/camera|generation|\bgen\b|cameragens/i, 'camera'],
  [/coverage|years?$|moving info|unofficial/i, 'coverage'],
  [/road ?lines?|roadline|street markings|^lines$|markings/i, 'road_lines'],
  [/bollard/i, 'bollards'],
  [/guardrail|guard rail|crash barrier/i, 'guardrails'],
  [/chevron/i, 'signs', 'chevrons'],
  [/\bstop\b/i, 'signs', 'stop'],
  [/yield|give way/i, 'signs', 'yield'],
  [/speed/i, 'signs', 'speed'],
  [/pedestrian|crosswalk|zebra/i, 'signs', 'pedestrian'],
  [/railway|railroad|level crossing/i, 'signs', 'railway'],
  [/animal ?warning/i, 'signs', 'animal_warning'],
  [/bus ?stop/i, 'signs', 'bus_stop'],
  [/tram/i, 'signs', 'tram'],
  [/back ?of ?signs/i, 'signs', 'back_of_signs'],
  [/city ?signs|town ?signs|place ?name/i, 'signs', 'city_signs'],
  [/direction/i, 'signs', 'directions'],
  [/sign ?posts?|signposts/i, 'signs', 'sign_posts'],
  [/road ?numbering|highway designation|route number/i, 'road_numbering'],
  [/street ?names?|street ?suffix/i, 'naming'],
  [/\bsigns?\b|street sign|chevron\/sign/i, 'signs'],
  [/milestone|kilometre|kilometer marker|km marker/i, 'milestones'],
  [/road surface|pavement|asphalt|dirt road|roads? in /i, 'road_surface'],
  [/driving ?(side|direction)|drives on/i, 'driving_side'],
  [/licen[cs]e ?plates?|number plate/i, 'plates'],
  [/vehicles?|cars$|truck|bus(es)?$/i, 'vehicles'],
  [/poles?|electricity|utility|pylon/i, 'poles'],
  [/house ?numbers?|post ?box|mailbox|traffic ?lights?|sidewalk|curb|kerb|snow ?poles?|^snow$|street ?lights?|fence/i, 'street_furniture'],
  [/language|alphabet|script|letters?|writing/i, 'language'],
  [/domain|tld/i, 'domain'],
  [/phone/i, 'phone'],
  [/flag/i, 'flag'],
  [/currenc/i, 'currency'],
  [/architect|building|house|roof/i, 'architecture'],
  [/vegetation|landscape|scener|nature|flora|soil|terrain|climate|rifts?|aceae\b|\bplants?\b|\btrees?\b|\bcrops?\b|agricultur/i, 'landscape'],
  [/sun|latitude|hemisphere/i, 'sun'],
  [/gas ?station|beer|brand|compan|shop|culture|religio|post$/i, 'culture'],
  [/capital|landmark|city|cities|locations|pinpoint/i, 'landmarks'],
  [/insulator/i, 'poles'],
  [/lamps?\b|street ?lights?|hydrant|booth|water tank|bench/i, 'street_furniture'],
  [/sticker|signback|sign ?back/i, 'signs', 'back_of_signs'],
  [/regional|province-specific|regions?\b/i, 'regions'],
]

// Palabras clave en el texto, para tips sin etiqueta útil.
const TEXT_RULES = [
  [/\bbollards?\b/i, 'bollards'],
  [/\b(utility|electric(ity)?|power|telephone) poles?\b|\bpoles?\b/i, 'poles'],
  [/\bchevrons?\b/i, 'signs', 'chevrons'],
  [/\bguardrails?\b|\bguard rails?\b/i, 'guardrails'],
  [/\blicen[cs]e plates?\b|\bplates?\b/i, 'plates'],
  [/\b(road ?lines?|centre line|center line|dashed|outer lines?|road markings?)\b/i, 'road_lines'],
  [/\b(gen ?[1-4]|generation|camera)\b/i, 'camera'],
  [/\b(google car|snorkel|roof rack|car is|follow car|antenna)\b/i, 'google_car'],
  [/\bcoverage\b/i, 'coverage'],
  [/\b(alphabet|letters?|language|script|diacritics?)\b/i, 'language'],
  [/\b(street names?|street signs?)\b|\bwords? for (street|road|avenue|village|town)\b|\b(streets?|roads?) (are|is) called\b/i, 'naming'],
  [/\bsigns?\b/i, 'signs'],
  [/\binsulators?\b|\btransformers?\b/i, 'poles'],
  [/\b(lamps?|street ?lights?|lamp ?posts?|hydrants?|(tele)?phone booths?|water tanks?|benches|mailboxe?s|post ?boxe?s|fences?|walls?)\b/i, 'street_furniture'],
  [/\b(taxis?|bus(es)?|trucks?|tuk-?tuks?|rickshaws?|motorbikes?|scooters?|cars)\b/i, 'vehicles'],
  [/\b(houses?|buildings?|roofs?|architecture|churche?s|mosques?|temples?)\b/i, 'architecture'],
  [/\b(trees?|vegetation|landscape|soil|mountains?|forests?|fields?|desert|cliffs?|valley|lakes?|rivers?|coast(line)?|beach(es)?|hills?|palms?|cacti|cactus|grass)\b/i, 'landscape'],
  [/\b(gas stations?|petrol stations?|shops?|stores?|chains?|brands?|banners?|flags?|patriotic)\b/i, 'culture'],
  [/\b(drive|driving) on the (left|right)\b/i, 'driving_side'],
  [/\b(provinces?|prefectures?|states?|county|counties|departments?|oblasts?|districts?)\b/i, 'regions'],
]

/**
 * @param {{label?: string|null, tags?: string[], text?: string|null, fallbackLabel?: string|null}} input
 *   fallbackLabel: etiqueta poco específica (p. ej. el título de sección) que solo
 *   se usa si ni la etiqueta, ni los tags, ni el texto permiten clasificar.
 * @returns {{category: string, subcategory: string|null, method: string}}
 */
export function classify({ label, tags = [], text, fallbackLabel }) {
  const tryRules = (value, rules) => {
    if (!value) return null
    for (const [re, cat, sub] of rules) if (re.test(value)) return { category: cat, subcategory: sub ?? null }
    return null
  }
  const byLabel = tryRules(label?.trim(), LABEL_RULES)
  if (byLabel) return { ...byLabel, method: 'label' }
  for (const tag of tags) {
    const byTag = tryRules(tag, LABEL_RULES)
    if (byTag) return { ...byTag, method: 'tag' }
  }
  const byText = tryRules(text, TEXT_RULES)
  if (byText) return { ...byText, method: 'text' }
  const byFallback = tryRules(fallbackLabel?.trim(), LABEL_RULES)
  if (byFallback) return { ...byFallback, method: 'section' }
  return { category: 'other', subcategory: null, method: 'none' }
}

export function seedCategories(db) {
  const stmt = db.prepare(
    `INSERT INTO categories (id, name, grp, ord) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, grp=excluded.grp, ord=excluded.ord`,
  )
  CATEGORIES.forEach(([id, name, grp], i) => stmt.run(id, name, grp, i))
}
