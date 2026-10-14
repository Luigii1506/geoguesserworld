import type { PathUnit } from './types'

// Ruta de aprendizaje guiada: el plan paso a paso de novato a avanzado.
// Una unidad se considera completada cuando TODAS sus preguntas de drill
// están en el calendario SM-2 (es decir, las has respondido al menos una vez).

export const PATH: PathUnit[] = [
  {
    id: 'fundamentos',
    title: 'Fundamentos: leer una ronda',
    icon: '🧭',
    goal: 'Sacar hemisferio, sentido de circulación y familia de señales de cualquier imagen en 20 segundos.',
    clueIds: ['sol-hemisferio', 'detectar-sentido', 'izquierda-mundo', 'advertencia-rombo-amarillo', 'generaciones-camara', 'modos-juego'],
    drillQuestionIds: ['q-sol-1', 'q-circ-1', 'q-circ-2', 'q-senal-5', 'q-meta-4', 'q-meta-6', 'q-general-1'],
  },
  {
    id: 'europa-occidental',
    title: 'Europa Occidental',
    icon: '🥖',
    goal: 'Separar Francia, Alemania, Países Bajos, Bélgica y Reino Unido por bolardos, matrículas y carteles.',
    clueIds: ['bolardos-como-usarlos', 'bolardo-frances', 'bolardo-aleman-austriaco', 'matricula-nl-amarilla', 'matricula-be-roja', 'colores-carteles-autopista', 'uk-doble-amarilla-bordillo', 'irlanda-lateral-amarilla'],
    drillQuestionIds: ['q-bolardo-1', 'q-bolardo-4', 'q-matricula-1', 'q-matricula-2', 'q-senal-4', 'q-lineas-3', 'q-senal-6'],
  },
  {
    id: 'nordicos',
    title: 'Nórdicos y Báltico',
    icon: '❄️',
    goal: 'Resolver el trío Suecia-Noruega-Finlandia y no volver a confundir los tres bálticos.',
    clueIds: ['nordicos-linea-central', 'dano-noruego-vs-sueco', 'advertencia-amarilla-nordica', 'fines-estonio', 'islandes-letras', 'suecia-2mas1', 'falu-rojo-nordico', 'iela-baltico', 'letonia-macrones'],
    drillQuestionIds: ['q-lineas-1', 'q-lineas-2', 'q-senal-1', 'q-idioma-12', 'q-idioma-1', 'q-general-2'],
  },
  {
    id: 'europa-central-este',
    title: 'Europa Central y del Este',
    icon: '🏰',
    goal: 'Leer las letras delatoras eslavas y húngaras, y partir el cirílico en ruso, ucraniano y balcánico.',
    clueIds: ['bolardo-checo-eslovaco', 'checo-vs-eslovaco', 'polaco-letra-l', 'hungaro-doble-acento', 'postes-hungria', 'rumano-comas', 'cirilico-ruso-vs-ucraniano', 'cirilico-bulgaro-serbio', 'ul-polonia', 'utca-hungria'],
    drillQuestionIds: ['q-bolardo-2', 'q-bolardo-3', 'q-idioma-2', 'q-idioma-3', 'q-idioma-4', 'q-topo-1', 'q-poste-1'],
  },
  {
    id: 'mediterraneo',
    title: 'Mediterráneo y Oriente Próximo',
    icon: '🫒',
    goal: 'Separar España de Portugal e Italia, Grecia de Chipre, y leer el par hebreo/árabe.',
    clueIds: ['espana-vs-portugal-idioma', 'azulejos-portugal', 'bolardo-espanol', 'teja-arabe-mediterraneo', 'olivos-mediterraneo', 'griego-alfabeto', 'turco-letras', 'turquia-banderas', 'hebreo-vs-arabe'],
    drillQuestionIds: ['q-idioma-15', 'q-idioma-13', 'q-idioma-11', 'q-arq-1', 'q-sol-2'],
  },
  {
    id: 'america',
    title: 'América de punta a punta',
    icon: '🌎',
    goal: 'ALTO contra PARE, matrículas que deciden países y los paisajes del continente.',
    clueIds: ['linea-central-amarilla', 'alto-vs-pare', 'arret-quebec', 'matricula-colombia-amarilla', 'matricula-mercosur', 'pampa-uy-ar', 'gauchito-gil', 'mexico-topes', 'andes-verdes', 'altiplano-andino', 'suburbios-usa', 'postes-madera-usa'],
    drillQuestionIds: ['q-senal-3', 'q-matricula-3', 'q-idioma-6', 'q-cultura-3', 'q-cultura-5', 'q-paisaje-6', 'q-arq-5'],
  },
  {
    id: 'asia',
    title: 'Asia: escrituras y circulación',
    icon: '🏮',
    goal: 'Reconocer las escrituras asiáticas de un vistazo y usar el sentido del tráfico como bisturí.',
    clueIds: ['tailandes-lao-jemer-birmano', 'vietnamita-diacriticos', 'japones-vs-coreano-vs-chino', 'devanagari-vs-bengali', 'vecinos-sentido-opuesto', 'stop-japon-triangulo', 'postes-japon', 'postes-tropicos-hormigon', 'casas-espiritus', 'jeepneys-filipinas', 'indonesia-vs-malasia', 'jalan-sudeste'],
    drillQuestionIds: ['q-idioma-7', 'q-idioma-8', 'q-idioma-9', 'q-idioma-14', 'q-senal-2', 'q-poste-2', 'q-cultura-1', 'q-cultura-2', 'q-matricula-4', 'q-topo-3'],
  },
  {
    id: 'africa-oceania',
    title: 'África y Oceanía',
    icon: '🦁',
    goal: 'Leer el coche de Google africano y separar los gemelos del hemisferio sur.',
    clueIds: ['kenia-snorkel', 'nigeria-escolta', 'madagascar-ladrillo', 'fynbos-cabo', 'rondavel-lesoto', 'eucaliptos-australia', 'nz-helechos', 'maori-toponimos', 'tierra-roja-tropical', 'bolardo-australia-nz'],
    drillQuestionIds: ['q-meta-1', 'q-meta-2', 'q-arq-2', 'q-paisaje-1', 'q-paisaje-3', 'q-circ-3', 'q-topo-2'],
  },
  {
    id: 'mundo-lugares',
    title: 'Mundo: lugares que valen 5000',
    icon: '🗽',
    goal: 'Reconocer al instante los monumentos, ciudades y parajes más repetidos.',
    clueIds: [],
    drillQuestionIds: ['q-land-torre-eiffel', 'q-land-coliseo', 'q-land-san-basilio', 'q-land-fuji', 'q-land-angkor', 'q-land-taj-mahal', 'q-land-cristo-redentor', 'q-land-machu-picchu', 'q-land-opera-sidney', 'q-land-montana-mesa'],
  },
  {
    id: 'meta-avanzado',
    title: 'Meta avanzado: pensar como el coche',
    icon: '📷',
    goal: 'Usar cobertura, generaciones y trekker para descartar países imposibles antes de empezar.',
    clueIds: ['paises-sin-cobertura', 'alemania-cobertura', 'trekker-panoramas', 'mongolia-offroad', 'ghana-cinta', 'madagascar-pickup', 'estepa-mongolia'],
    drillQuestionIds: ['q-meta-3', 'q-meta-5', 'q-paisaje-2', 'q-general-3'],
  },
]

export const PATH_MAP = new Map(PATH.map((u) => [u.id, u]))
