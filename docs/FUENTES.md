# Investigación de fuentes — GeoMastery

Fecha de investigación: **2026-10-11**. Métodos: consulta directa de portada + páginas
internas de cada sitio, verificación de repositorios GitHub y archivos LICENSE en crudo,
prueba de APIs, snapshots del Internet Archive cuando el sitio bloquea bots, y búsqueda
web como respaldo. Donde una fuente no pudo consultarse automáticamente, se documenta la
limitación exacta; no se inventaron resultados.

**Regla derivada de esta investigación** (aplicada en toda la app): ninguna de las ocho
fuentes publica una licencia abierta para su contenido editorial. Por tanto GeoMastery
**redacta contenido propio y enlaza con atribución**; nunca copia textos, imágenes ni
bases de datos.

---

## 1. Plonk It — plonkit.net

- **Qué ofrece:** guías paso a paso por país (~140 países y territorios, incluidos
  Pitcairn, Groenlandia o subdivisiones como Alaska y Hong Kong) y una guía de
  principiantes muy completa (puntuación, modos, sol, conducción, idioma, vegetación).
  La guía de Kenia, por ejemplo, tiene 45 tips estructurados con imagen, texto y
  etiquetas, cada imagen enlazada a su ubicación real en Google Maps.
- **Practicidad:** la más alta para aprendizaje sistemático país por país; es el
  recurso estándar de la comunidad.
- **Interactividad:** solo lectura. Sin quizzes, sin API, sin repositorio oficial
  (existen derivados no oficiales: extensión "Plonk It Checker", mazo Anki de 4.163
  notas). Comunidad en Discord.
- **Licencia:** sin licencia explícita → todos los derechos reservados; además sus
  imágenes son capturas de Street View (derechos de Google de fondo). Solo enlazar.
- **Uso en GeoMastery:** enlace por país desde cada página de país
  (`plonkit.net/<slug>`, mapa de slugs en `src/data/plonkit.ts`) y la guía de
  principiantes como lectura complementaria.
- **Limitaciones:** sin autoevaluación; SPA React (los enlaces profundos requieren JS);
  sin fechas de actualización visibles.
- URLs verificadas: `/guide`, `/beginners-guide`, `/kenya`, `/japan`.

## 2. GeoTips — geotips.net

- **Qué ofrece:** consejos generales y guías por país agrupadas en 6 páginas regionales
  enormes (la de Europa supera los 400k caracteres), con secciones por país: Google Car,
  bolardos, señales, matrículas, arquitectura, dominio. Récords mundiales y liga propia.
- **Practicidad:** buena segunda opinión; menos granular y menos actualizada que Plonk It.
- **Interactividad:** sin API ni quizzes propios. Su página `/resources/` es un
  directorio de userscripts de terceros y de la hoja "Camera Types Explanation".
- **Licencia:** sin licencia explícita (solo "Copyright © GeoTips") → solo enlazar.
- **Uso en GeoMastery:** enlaces regionales y `/resources/` como directorio de
  herramientas.
- **Limitaciones:** países como anclas dentro de páginas gigantes y lentas; imágenes
  rotas puntuales; parte del contenido desactualizado.

## 3. JetPunk — jetpunk.com

- **Qué ofrece:** quizzes de trivia (geografía como categoría estrella): países del
  mundo, capitales, banderas, mapas interactivos (Click Map), charts, reto diario.
  Multiidioma, incluido español.
- **Practicidad:** excelente para la base memorística (países/capitales/banderas) que
  las fuentes de metas no cubren.
- **Acceso:** **bloquea clientes automatizados (HTTP 403)**; se documentó vía Wikipedia
  y snapshots del Internet Archive de su ToS y About.
- **Licencia:** copyright expreso de H Brothers Inc.; el ToS no concede derechos de
  reutilización a terceros y tiene procedimiento DMCA. Solo enlazar.
- **Uso en GeoMastery:** enlaces de práctica externa desde el módulo Práctica.
- **Limitaciones:** nada específico de Street View; publicidad; integración automática
  imposible.

## 4. GeoHints — geohints.com

- **Qué ofrece:** diccionario visual comparativo: ~23 categorías de meta
  (`/meta/architecture`, `bollards`, `cameraGens`, `drivingSide`, `licensePlates`,
  `lines`, `utilityPoles`, `streetSuffix`…), señales (`/meta/signs/...`), vehículos de
  Google (`/meta/googleVehicles/...`) y empresas. Formato "misma categoría, todos los
  países en una página" — complementario al enfoque de Plonk It.
- **Practicidad:** muy alta como referencia de consulta rápida y para discriminar
  países parecidos. Gratuito y sin anuncios (declarado en su FAQ).
- **Interactividad:** un juego propio de bolardos (`/games/bollards`). Sin API ni GitHub.
  Su `/usefulResources` es un directorio excelente de guías comunitarias y mapas.
- **Licencia:** sin licencia explícita → solo enlazar con atribución. Imágenes derivadas
  de Street View.
- **Detalle técnico:** rutas case-sensitive en camelCase minúscula
  (`/meta/utilityPoles` sí; `/Meta/Bollards` da 404).
- **Uso en GeoMastery:** cada laboratorio enlaza su categoría como tabla visual de
  referencia; el juego de bolardos como práctica externa.
- **Limitaciones:** casi sin texto explicativo (muestra el qué, no el porqué — el hueco
  que esta app rellena); guías por país casi inexistentes (solo EE. UU.).

## 5. Geometas — geometas.com

- **Qué ofrece:** fichas imagen+explicación breve en 18 categorías con recuento
  (Street Sign 111, License Plate 58, Google Car 58, Poles 51, Language 49, Bollards
  46…) sobre ~100 países; guías introductorias (`/learn/`: cobertura por país, sentido
  de circulación, ubicaciones comunes) y quizzes. Proyecto de PaulPlay (OpenGuessr).
- **Practicidad:** alta; el formato más "app de estudio" de las fuentes tipo guía.
- **Interactividad:** quizzes; **API JSON pública sin autenticación**
  (`GET geometas.com/api/metas/countries/{slug}`, probada y funcional) aunque no
  documentada como estable.
- **Licencia:** código MIT + Commons Clause v1.0 (prohibido uso comercial); el
  **contenido no tiene licencia** y además procede de Plonk It y The Digital Labyrinth
  según sus propios créditos → solo enlazar. La página legal del operador
  (openguessr.com/legal) devolvió 403.
- **Uso en GeoMastery:** enlaces por país y categoría; sus guías de cobertura y
  circulación como lectura.
- **Limitaciones:** pocas metas en algunos países (España: 7); sin técnica avanzada;
  estado legal del contenido ambiguo.

## 6. VirtualStreets — virtualstreets.org

- **Qué ofrece:** periodismo de cobertura: resúmenes mensuales de Street View,
  campañas de coches de Google, Apple Look Around, Yandex. Versiones en inglés, español
  y francés. Archivo desde 2021.
- **Practicidad:** indirecta pero valiosa: saber dónde hay cobertura nueva o Gen 4 es
  un meta en sí; los jugadores serios siguen estas noticias.
- **Interactividad:** sin quizzes ni API; RSS disponible (`/index.php/feed/`);
  subdominio `updates.virtualstreets.org` como rastreador.
- **Licencia:** todos los derechos reservados; **prohíbe expresamente el uso de su
  contenido para entrenamiento de IA/LLM**. Solo enlazar con atribución.
- **Uso en GeoMastery:** enlace de verificación desde las fichas "meta" (que pueden
  caducar) y desde la lista de países sin cobertura.
- **Limitaciones:** formato blog cronológico; no estructura conocimiento por país.

## 7. OpenGuessr Education — education.openguessr.com

- **Acceso:** el sitio en vivo devolvió **HTTP 403** persistente a clientes
  automatizados (portada y `/quizzes`, también con user-agent de navegador). Todo lo
  siguiente proviene de su repositorio oficial
  (`github.com/therealPaulPlay/OpenGuessrEducation`) y de fichas de terceros;
  conviene verificar en navegador antes de enlazar rutas profundas.
- **Qué ofrece (según repo):** quizzes por dificultad (regiones, banderas, bolardos,
  postes), guías interactivas por nivel, artículos por país, mapas topojson. Acepta
  contribuciones por PR; prohíbe artículos escritos solo por IA.
- **Licencia:** **MIT + Commons Clause v1.0 verificada en LICENSE** (uso no comercial,
  conservando el aviso de Paul Rhomberg). Cubre el código y el contenido incluido en
  el repo.
- **Uso en GeoMastery:** enlace general de práctica; el repo como referencia.
- **Limitaciones:** solo inglés; 403 a integraciones server-side; mantenedor único.

## 8. Learnable Meta — learnablemeta.com

- **Qué ofrece:** aprendizaje dentro del propio GeoGuessr: mapas comunitarios
  etiquetados + userscript que muestra la explicación de la meta tras cada guess.
  Mapas oficiales de "trausi" (World, Basics, Bollards, Google Cars, Europe, Latin
  America…), mapas personales y creación propia. Recomiendan partidas No Move.
- **Practicidad:** la mayor retención real de todas las fuentes (práctica activa con
  feedback inmediato en contexto), a cambio de fricción de instalación y cuenta de
  GeoGuessr.
- **Interactividad:** API pública no documentada (`GET learnablemeta.com/api/maps`,
  probada); monorepo **AGPL-3.0** (`github.com/likeon/geometa` — ojo, se llama
  "geometa" pero es un proyecto distinto de geometas.com): userscript, SvelteKit,
  API Bun/PostgreSQL, bot de Discord en Rust.
- **Licencia:** código AGPL-3.0 (copyleft fuerte: reutilizarlo en un servicio en red
  obliga a liberar el propio código); contenido en parte derivado de Plonk It, sin
  licencia propia → solo enlazar.
- **Uso en GeoMastery:** es el "siguiente paso" recomendado tras estudiar aquí; se
  enlaza su onboarding (`/docs/getting-started`) y catálogo de mapas.
- **Limitaciones:** depende de GeoGuessr (cuenta de pago para uso completo; cambios
  pueden romper el userscript); sin modo de estudio fuera del juego.

---

## Síntesis: qué se enlaza desde cada parte de la app

| Necesidad | Fuente | Patrón de enlace |
|---|---|---|
| Aprender un país de cero | Plonk It | `plonkit.net/<slug>` |
| Fundamentos / onboarding | Plonk It | `plonkit.net/beginners-guide` |
| Comparar una meta entre países | GeoHints | `geohints.com/meta/<categoría>` (camelCase) |
| Fichas de metas por país | Geometas | `geometas.com/metas/countries/<país>/` |
| Memorizar países/capitales/banderas | JetPunk | enlaces a quizzes concretos |
| Práctica de metas (juego) | GeoHints | `geohints.com/games/bollards` |
| Práctica in-game con feedback | Learnable Meta | `/docs/getting-started` + `/maps` |
| Verificar cobertura/generaciones | VirtualStreets | `/index.php/svcoverage/` + RSS |

## Advertencias legales del proyecto

1. Ninguna fuente licencia abiertamente su contenido editorial; las licencias abiertas
   encontradas (MIT + Commons Clause, AGPL-3.0) cubren **código**, no textos ni imágenes.
2. Cadena de atribución: Geometas y Learnable Meta declaran importar contenido de
   Plonk It. Copiar de ellas reproduciría contenido de terceros sin licencia localizable.
3. Doble capa de copyright: las capturas de todos estos sitios provienen de Google
   Street View.
4. Las dos APIs públicas encontradas (Geometas, Learnable Meta) no están documentadas
   como estables ni licenciadas para terceros: usar con moderación y atribución, o pedir
   permiso en sus Discords.
5. VirtualStreets prohíbe el uso de su contenido para entrenamiento de IA/LLM.
6. JetPunk y OpenGuessr Education bloquean clientes automatizados: la única integración
   viable es el enlace directo abierto por el usuario.
7. Fragilidad de enlaces: GeoHints es case-sensitive; GeoTips usa anclas en páginas
   gigantes; Plonk It es SPA. Conviene revisar los enlaces periódicamente.
