import type { Category } from './types'

// Taxonomía de dominios (sección 4 del diseño):
// A Geografía física · B Infraestructura vial · C Idiomas y escritura
// D Arquitectura · E Electricidad/telecom · F Cultura · G Meta de GeoGuessr

export const CATEGORIES: Category[] = [
  {
    id: 'lineas-viales',
    name: 'Líneas viales',
    domain: 'B',
    description:
      'Color y patrón de líneas centrales y laterales: una de las primeras pistas visibles en casi cualquier ronda.',
    icon: '🛣️',
  },
  {
    id: 'bolardos',
    name: 'Bolardos y delineadores',
    domain: 'B',
    description:
      'Postes bajos al borde de la carretera. Muchos países europeos tienen diseños casi únicos: evidencia fuerte cuando se ve de cerca.',
    icon: '🦺',
  },
  {
    id: 'senales',
    name: 'Señales de tráfico',
    domain: 'B',
    description:
      'Forma, color y tipografía de señales: ceda el paso, chevrones, advertencias y carteles direccionales.',
    icon: '⚠️',
  },
  {
    id: 'matriculas',
    name: 'Matrículas y vehículos',
    domain: 'B',
    description:
      'Color, formato y franjas de las matrículas (aunque vayan borrosas, el color base se distingue), más tipos de vehículos locales.',
    icon: '🚗',
  },
  {
    id: 'circulacion',
    name: 'Sentido de circulación',
    domain: 'B',
    description:
      'Conducir por la izquierda o la derecha parte el mundo en dos. Se deduce de coches aparcados, señales y marcas viales.',
    icon: '↔️',
  },
  {
    id: 'mobiliario',
    name: 'Mobiliario vial y urbano',
    domain: 'B',
    description:
      'Guardarraíles, hitos kilométricos, buzones, semáforos, bordillos y números de casa: detalles pequeños que delatan país.',
    icon: '🏙️',
  },
  {
    id: 'postes',
    name: 'Postes y cables',
    domain: 'E',
    description:
      'Material, forma y disposición de postes eléctricos y telefónicos, aisladores y transformadores.',
    icon: '⚡',
  },
  {
    id: 'idioma',
    name: 'Idiomas y escritura',
    domain: 'C',
    description:
      'Alfabetos, diacríticos y palabras frecuentes en señales: la pista más fiable cuando sabes leerla.',
    icon: '🔤',
  },
  {
    id: 'toponimia',
    name: 'Topónimos y nomenclatura',
    domain: 'C',
    description:
      'Patrones en nombres de calles y lugares: sufijos, prefijos y convenciones nacionales.',
    icon: '🏷️',
  },
  {
    id: 'arquitectura',
    name: 'Arquitectura',
    domain: 'D',
    description:
      'Techos, materiales, fachadas y formas de vivienda que delatan región y clima.',
    icon: '🏠',
  },
  {
    id: 'paisaje',
    name: 'Paisaje y vegetación',
    domain: 'A',
    description:
      'Biomas, cultivos, relieve y suelos: la pista de fondo que acota continente y región.',
    icon: '🌿',
  },
  {
    id: 'clima-sol',
    name: 'Clima, sol y latitud',
    domain: 'A',
    description:
      'Posición del sol, sombras, estación aparente y nieve: hemisferio y latitud aproximada.',
    icon: '☀️',
  },
  {
    id: 'cultura',
    name: 'Cultura y economía',
    domain: 'F',
    description:
      'Comercios, marcas locales, religión visible, vestimenta y actividad económica.',
    icon: '🛖',
  },
  {
    id: 'mundo',
    name: 'Ciudades y monumentos',
    domain: 'F',
    description:
      'Lugares reconocibles al instante: monumentos, skylines y parajes que valen un 5000 cuando los has visto antes.',
    icon: '🗽',
  },
  {
    id: 'meta-camara',
    name: 'Meta: cámara y Google Car',
    domain: 'G',
    description:
      'Generaciones de cámara, partes visibles del coche, antenas y escoltas. Útil pero caduca: depende de la cobertura.',
    icon: '📷',
  },
  {
    id: 'meta-cobertura',
    name: 'Meta: cobertura',
    domain: 'G',
    description:
      'Qué países tienen cobertura oficial, trekker o fotógrafos locales, y qué implica para el juego.',
    icon: '🗺️',
  },
]

export const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]))

export const DOMAINS: Record<string, string> = {
  A: 'Geografía física',
  B: 'Infraestructura vial',
  C: 'Idiomas y escritura',
  D: 'Arquitectura y entorno urbano',
  E: 'Electricidad y telecomunicaciones',
  F: 'Cultura y geografía humana',
  G: 'Meta de GeoGuessr',
}
