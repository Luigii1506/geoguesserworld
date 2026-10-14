export interface Source {
  id: string
  name: string
  url: string
  type: string
  summary: string
  coverage: string
  license: string
  useInApp: string
  limitations: string
  checkedAt: string
}

// Resultado de la investigación de fuentes (2026-10-11).
// Regla del proyecto: el contenido de GeoMastery es SIEMPRE redacción propia;
// las fuentes se enlazan con atribución, nunca se copian textos, imágenes ni datasets.

export const SOURCES: Source[] = [
  {
    id: 'plonkit',
    name: 'Plonk It',
    url: 'https://www.plonkit.net/guide',
    type: 'Guías por país',
    summary:
      'Guías paso a paso para ~140 países y territorios, más una guía de principiantes muy completa. Cada tip lleva captura de Street View enlazada a la ubicación real. El recurso estándar de la comunidad para aprender país por país.',
    coverage: 'Mundial casi total (incluye territorios pequeños y subdivisiones como Alaska o Hong Kong).',
    license:
      'Sin licencia explícita → todos los derechos reservados. Solo enlazar con atribución; las imágenes además son capturas de Google (doble capa de copyright).',
    useInApp:
      'Cada ficha de la Academia enlaza a la guía del país correspondiente (plonkit.net/<slug>). La guía de principiantes es el complemento de lectura recomendado.',
    limitations:
      'Solo lectura: sin quizzes, sin API, sin autoevaluación. Es una SPA (los enlaces profundos requieren JavaScript).',
    checkedAt: '2026-10-11',
  },
  {
    id: 'geohints',
    name: 'GeoHints',
    url: 'https://geohints.com/',
    type: 'Referencia visual comparativa',
    summary:
      'Diccionario visual de ~23 categorías de meta (bolardos, postes, matrículas, líneas, generaciones de cámara, señales...) con fotos comparativas de todos los países en una página. Complemento perfecto de los laboratorios de esta app.',
    coverage: 'Mundial por categoría; guías por país apenas iniciadas (solo EE. UU.).',
    license:
      'Sin licencia explícita → todos los derechos reservados. Solo enlazar con atribución. Ojo: las rutas son case-sensitive en minúscula camelCase (/meta/utilityPoles).',
    useInApp:
      'Los laboratorios enlazan a su categoría correspondiente como tabla de imágenes de referencia. Tiene un juego propio de bolardos (geohints.com/games/bollards).',
    limitations:
      'Casi sin texto explicativo: muestra el qué, no el porqué (que es justo lo que esta app añade). Sin fechas de actualización.',
    checkedAt: '2026-10-11',
  },
  {
    id: 'geotips',
    name: 'GeoTips',
    url: 'https://geotips.net/',
    type: 'Guías regionales + recursos',
    summary:
      'Consejos generales y guías por país agrupadas en seis páginas regionales gigantes, con secciones de Google Car, bolardos, señales, matrículas y arquitectura por país. Incluye directorio de userscripts y la hoja "Camera Types".',
    coverage: 'Mundial por regiones (Europa, Asia, Sudamérica, Norteamérica, África, Oceanía).',
    license:
      'Sin licencia explícita (solo "Copyright © GeoTips") → todos los derechos reservados; solo enlazar con atribución.',
    useInApp:
      'Enlaces regionales como segunda opinión por país y su página /resources/ como directorio de herramientas de la comunidad.',
    limitations:
      'Países enterrados como anclas en páginas enormes y lentas; parte del contenido desactualizado; sin buscador.',
    checkedAt: '2026-10-11',
  },
  {
    id: 'jetpunk',
    name: 'JetPunk',
    url: 'https://www.jetpunk.com/',
    type: 'Quizzes de geografía',
    summary:
      'Plataforma de quizzes de trivia con la geografía como categoría estrella: países del mundo, capitales, banderas, mapas interactivos (Click Map). Ideal para la base memorística que GeoGuessr presupone.',
    coverage: 'Mundial; quizzes en varios idiomas, incluido español.',
    license:
      'Copyright expreso de H Brothers Inc.; sus términos no conceden reutilización a terceros y el sitio bloquea bots (403). Solo enlazar.',
    useInApp:
      'Enlaces de práctica complementaria desde el módulo de Práctica (países, capitales, banderas).',
    limitations:
      'Nada específico de Street View ni metas; con publicidad; integración automática imposible.',
    checkedAt: '2026-10-11',
  },
  {
    id: 'geometas',
    name: 'Geometas',
    url: 'https://geometas.com/',
    type: 'Catálogo de metas + quizzes',
    summary:
      'Fichas imagen+explicación de ~18 categorías en ~100 países, guías introductorias (cobertura, sentido de circulación) y quizzes. El formato más parecido a una app de estudio. Tiene API JSON pública no documentada.',
    coverage: '~100 países; Europa del Este y Sudeste Asiático son las regiones más densas.',
    license:
      'Código MIT + Commons Clause (no comercial); el CONTENIDO no tiene licencia y procede en parte de Plonk It → solo enlazar con atribución. API pública pero no licenciada para terceros: usar con moderación.',
    useInApp:
      'Enlaces por país (geometas.com/metas/countries/<país>) y por categoría; sus guías de cobertura y circulación como lectura.',
    limitations:
      'Pocas metas en algunos países (España: 7); contenido derivado de terceros; login para algunas funciones.',
    checkedAt: '2026-10-11',
  },
  {
    id: 'virtualstreets',
    name: 'VirtualStreets',
    url: 'https://virtualstreets.org/',
    type: 'Noticias de cobertura Street View',
    summary:
      'Periodismo de cobertura: resúmenes mensuales de novedades de Street View, campañas de los coches de Google, Apple Look Around y Yandex. Saber dónde hay cobertura nueva es un meta en sí mismo.',
    coverage: 'Mundial, orientado a novedades; versión en español disponible.',
    license:
      'Todos los derechos reservados; prohíbe expresamente usar su contenido para entrenamiento de IA/LLM. Solo enlazar con atribución. RSS disponible para titulares.',
    useInApp:
      'Enlace permanente desde las fichas "meta" para verificar si una pista de cobertura sigue vigente.',
    limitations:
      'No estructura conocimiento por país para jugar; formato blog cronológico; sin ejercicios.',
    checkedAt: '2026-10-11',
  },
  {
    id: 'openguessr-edu',
    name: 'OpenGuessr Education',
    url: 'https://education.openguessr.com/',
    type: 'Hub educativo con quizzes',
    summary:
      'Quizzes por dificultad (regiones, banderas, bolardos, postes), guías interactivas y artículos por país, del mismo autor que Geometas. El sitio bloquea clientes automatizados (403): documentado vía su repositorio oficial.',
    coverage: 'Por país y por tema; alcance exacto no cuantificable por el bloqueo.',
    license:
      'MIT + Commons Clause verificada en el repo (uso no comercial del código y contenido del repo, conservando el aviso de copyright de Paul Rhomberg).',
    useInApp:
      'Enlace general de práctica gamificada; su repo GitHub como referencia de estructura de contenido.',
    limitations:
      'Solo inglés; bloqueo 403 a integraciones server-side; mantenedor único.',
    checkedAt: '2026-10-11',
  },
  {
    id: 'learnablemeta',
    name: 'Learnable Meta',
    url: 'https://learnablemeta.com/docs/getting-started',
    type: 'Aprendizaje dentro de GeoGuessr',
    summary:
      'Mapas comunitarios + userscript que muestra la explicación de la meta tras cada guess, dentro del propio GeoGuessr. La herramienta con mayor retención real: práctica activa con feedback inmediato.',
    coverage: 'Mapas mundiales y regionales (World, Europe, Latin America, Bollards, Google Cars...).',
    license:
      'Código AGPL-3.0 (copyleft fuerte); el contenido de metas procede en parte de Plonk It, sin licencia propia → solo enlazar.',
    useInApp:
      'Es el "siguiente paso" recomendado tras estudiar aquí: los módulos de práctica enlazan su onboarding y catálogo de mapas.',
    limitations:
      'Requiere cuenta de GeoGuessr y gestor de userscripts; sin modo de estudio fuera del juego.',
    checkedAt: '2026-10-11',
  },
]
