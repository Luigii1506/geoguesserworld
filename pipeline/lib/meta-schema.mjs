// Esquema de rasgos por tipo de objeto. Los valores son vocabularios cerrados
// para que dos países se puedan comparar ("red" siempre es "red"); los detalles
// que no encajan van en "features" como texto libre corto.

const COLORS = ['white', 'black', 'yellow', 'orange', 'red', 'blue', 'green', 'grey', 'brown', 'silver', 'none', 'other']

export const OBJECT_TYPES = {
  bollard: {
    label: 'Bolardo',
    categories: ['bollards'],
    attrs: {
      body_color: COLORS,
      marking_color: COLORS, // franja, banda o parte superior de otro color
      marking_position: ['top', 'middle', 'band', 'diagonal', 'full', 'none', 'other'],
      shape: ['round', 'flat', 'triangular', 'wedge', 'square', 'rectangular', 'other'],
      top: ['pointed', 'flat', 'slanted', 'rounded', 'other'],
      front_reflector_color: COLORS,
      back_reflector_color: COLORS,
      reflector_shape: ['rectangle', 'square', 'circle', 'diamond', 'strip', 'dots', 'other'],
    },
  },
  road_lines: {
    label: 'Líneas viales',
    categories: ['road_lines'],
    attrs: {
      outer_line_color: COLORS,
      center_line_color: COLORS,
      center_line_style: ['solid', 'dashed', 'double', 'none', 'mixed'],
      outer_line_style: ['solid', 'dashed', 'double', 'none', 'mixed'],
    },
  },
  licence_plate: {
    label: 'Matrícula',
    categories: ['plates'],
    attrs: {
      front_color: COLORS,
      rear_color: COLORS,
      text_color: COLORS,
      side_strip: ['eu_blue', 'blue', 'red', 'green', 'yellow', 'other', 'none'],
      shape: ['long', 'short', 'square', 'other'],
    },
  },
  utility_pole: {
    label: 'Poste',
    categories: ['poles'],
    attrs: {
      material: ['concrete', 'wood', 'metal', 'other'],
      cross_section: ['round', 'square', 'rectangular', 'h_shape', 'other'],
      surface: ['plain', 'holes', 'ladder', 'ribbed', 'painted', 'other'],
      color: COLORS,
    },
  },
  chevron: {
    label: 'Chevrón',
    categories: ['signs'],
    attrs: { background_color: COLORS, arrow_color: COLORS, border_color: COLORS },
  },
  warning_sign: {
    label: 'Señal de advertencia',
    categories: ['signs'],
    attrs: {
      shape: ['triangle', 'diamond', 'other'],
      background_color: COLORS,
      border_color: COLORS,
    },
  },
  stop_sign: {
    label: 'Señal de stop',
    categories: ['signs'],
    attrs: {
      shape: ['octagon', 'triangle', 'other'],
      text: ['STOP', 'ALTO', 'PARE', 'ARRET', 'other_text', 'no_text'],
      border_color: COLORS,
    },
  },
  sign_back: {
    label: 'Parte trasera de señales',
    categories: ['signs'],
    attrs: { back_color: COLORS, frame: ['none', 'metal_frame', 'tubes', 'other'] },
  },
  google_car: {
    label: 'Coche de Google',
    categories: ['google_car', 'camera'],
    attrs: {
      car_color: COLORS,
      roof_rack: ['visible', 'none', 'other'],
      antenna: ['visible', 'none', 'other'],
      follow_car: ['yes', 'no'],
      vehicle_type: ['car', 'pickup', 'suv', 'truck', 'trekker', 'boat', 'other'],
    },
  },
  guardrail: {
    label: 'Guardarraíl',
    categories: ['guardrails'],
    attrs: {
      profile: ['w_beam', 'b_profile', 'cable', 'wood', 'concrete', 'box', 'other'],
      color: COLORS,
      post_shape: ['round', 'square', 'c_profile', 'i_beam', 'other'],
    },
  },
}

export function describeSchema(types) {
  return types
    .map((t) => {
      const o = OBJECT_TYPES[t]
      const attrs = Object.entries(o.attrs).map(([k, v]) => `    ${k}: ${v.join(' | ')}`)
      return `  ${t}:\n${attrs.join('\n')}`
    })
    .join('\n')
}

/** Tipos de objeto que se buscan en una categoría de pistas. */
export function typesForCategory(category) {
  return Object.entries(OBJECT_TYPES)
    .filter(([, o]) => o.categories.includes(category))
    .map(([t]) => t)
}
