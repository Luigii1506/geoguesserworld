// Etiquetas en español para la taxonomía, los objetos de meta y sus rasgos.

export const SOURCE_NAMES: Record<string, string> = {
  plonkit: 'Plonk It',
  geotips: 'GeoTips',
  geometas: 'Geometas',
  geohints: 'GeoHints',
  learnablemeta: 'Learnable Meta',
  openguessr: 'OpenGuessr',
}

export const SOURCE_SHORT: Record<string, string> = {
  plonkit: 'PI',
  geotips: 'GT',
  geometas: 'GM',
  geohints: 'GH',
  learnablemeta: 'LM',
  openguessr: 'OG',
}

export const USEFULNESS: Record<number, { label: string; tone: string; help: string }> = {
  3: { label: 'Determinante', tone: 'fuerte', help: 'Por sí sola te ubica' },
  2: { label: 'Útil', tone: 'moderada', help: 'Acota o confirma junto a otras' },
  1: { label: 'Detalle', tone: 'contextual', help: 'Contexto o dato menor' },
}

export const OBJECT_LABEL: Record<string, { label: string }> = {
  bollard: { label: 'Bolardo' },
  road_lines: { label: 'Líneas viales' },
  licence_plate: { label: 'Matrícula' },
  utility_pole: { label: 'Poste' },
  chevron: { label: 'Chevrón' },
  warning_sign: { label: 'Señal de advertencia' },
  stop_sign: { label: 'Señal de stop' },
  sign_back: { label: 'Trasera de señales' },
  google_car: { label: 'Coche de Google' },
  guardrail: { label: 'Guardarraíl' },
}

/** Tema de la guía (categoría) en el que se muestra cada tipo de objeto. */
export const OBJECT_CATEGORY: Record<string, string> = {
  bollard: 'bollards',
  road_lines: 'road_lines',
  licence_plate: 'plates',
  utility_pole: 'poles',
  chevron: 'signs',
  warning_sign: 'signs',
  stop_sign: 'signs',
  sign_back: 'signs',
  google_car: 'google_car',
  guardrail: 'guardrails',
}

export const SUBCATEGORY_LABEL: Record<string, string> = {
  speed: 'Límites de velocidad',
  bus_stop: 'Paradas de autobús',
  railway: 'Pasos a nivel',
  city_signs: 'Entrada de población',
  pedestrian: 'Paso de peatones',
  directions: 'Señales de dirección',
  animal_warning: 'Fauna',
  stop: 'Stop',
  sign_posts: 'Postes de señales',
  chevrons: 'Chevrones',
  tram: 'Tranvía',
  yield: 'Ceda el paso',
  back_of_signs: 'Traseras de señales',
  warning: 'Advertencia',
  other: 'Otras',
  gas_station: 'Gasolineras',
  beer: 'Cervezas',
  post: 'Correos',
}

export const ATTR_LABEL: Record<string, string> = {
  body_color: 'Color del cuerpo',
  marking_color: 'Color de la marca',
  marking_position: 'Posición de la marca',
  shape: 'Forma',
  top: 'Parte superior',
  front_reflector_color: 'Reflector delantero',
  back_reflector_color: 'Reflector trasero',
  reflector_shape: 'Forma del reflector',
  outer_line_color: 'Línea exterior',
  center_line_color: 'Línea central',
  center_line_style: 'Estilo central',
  outer_line_style: 'Estilo exterior',
  front_color: 'Color delantero',
  rear_color: 'Color trasero',
  text_color: 'Color del texto',
  side_strip: 'Franja lateral',
  material: 'Material',
  cross_section: 'Sección',
  surface: 'Superficie',
  color: 'Color',
  background_color: 'Fondo',
  arrow_color: 'Flecha',
  border_color: 'Borde',
  text: 'Texto',
  back_color: 'Color trasero',
  frame: 'Marco',
  car_color: 'Color del coche',
  roof_rack: 'Baca',
  antenna: 'Antena',
  follow_car: 'Coche escolta',
  vehicle_type: 'Vehículo',
  profile: 'Perfil',
  post_shape: 'Forma del poste',
}

export const VALUE_LABEL: Record<string, string> = {
  white: 'blanco', black: 'negro', yellow: 'amarillo', orange: 'naranja', red: 'rojo', blue: 'azul',
  green: 'verde', grey: 'gris', brown: 'marrón', silver: 'plateado', none: 'ninguno', other: 'otro',
  top: 'arriba', middle: 'en medio', band: 'banda', diagonal: 'diagonal', full: 'completa',
  round: 'redondo', flat: 'plano', triangular: 'triangular', wedge: 'cuña', square: 'cuadrado',
  rectangular: 'rectangular', pointed: 'puntiaguda', slanted: 'inclinada', rounded: 'redondeada',
  rectangle: 'rectángulo', circle: 'círculo', diamond: 'rombo', strip: 'tira', dots: 'puntos',
  solid: 'continua', dashed: 'discontinua', double: 'doble', mixed: 'mixta',
  eu_blue: 'azul UE', long: 'alargada', short: 'corta',
  concrete: 'hormigón', wood: 'madera', metal: 'metal', h_shape: 'en H',
  plain: 'lisa', holes: 'con agujeros', ladder: 'escalera', ribbed: 'acanalada', painted: 'pintada',
  triangle: 'triángulo', octagon: 'octógono', STOP: 'STOP', ALTO: 'ALTO', PARE: 'PARE', ARRET: 'ARRÊT',
  other_text: 'otro texto', no_text: 'sin texto', metal_frame: 'marco metálico', tubes: 'tubos',
  visible: 'visible', yes: 'sí', no: 'no', car: 'coche', pickup: 'pickup', suv: 'SUV', truck: 'camión',
  trekker: 'trekker', boat: 'barco', w_beam: 'perfil en W', b_profile: 'perfil B', cable: 'cable',
  box: 'cajón', c_profile: 'perfil C', i_beam: 'perfil I',
}

export const VARIANT_LABEL: Record<string, string> = {
  main: 'principal',
  regional: 'regional',
  special: 'especial',
  old: 'antiguo',
}

export const COLOR_HEX: Record<string, string> = {
  white: '#f5f3ec', black: '#1d1d1b', yellow: '#f2c230', orange: '#e8862b', red: '#c8352b',
  blue: '#2f62b8', green: '#2f8a4f', grey: '#9a9a96', brown: '#7a5233', silver: '#c8cbd0',
}

export const valueLabel = (v: string) => VALUE_LABEL[v] ?? v.replace(/_/g, ' ')
export const attrLabel = (k: string) => ATTR_LABEL[k] ?? k.replace(/_/g, ' ')

export const REGION_ES: Record<string, string> = {
  Europe: 'Europa', Asia: 'Asia', Africa: 'África', Americas: 'América', Oceania: 'Oceanía', Antarctic: 'Antártida',
}
