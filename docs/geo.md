# Geografía: datos, almacenamiento y API

Contrato de la base geográfica de GeoMastery. Todo lo que es geografía
(países, regiones, ciudades, volcanes, ríos, cordilleras, llanuras, capas de
terreno…) sigue este modelo; añadir una fuente o una capa nueva es añadir un
archivo, sin tocar el resto.

## Capas de datos

```
data/raw/<fuente>/            1. crudo: descargas tal cual, con caché (fuera de git)
data/geomastery.db            2. staging del pipeline (pistas, atlas, gvp, place_info…)
data/geo.db                   3. modelo de lectura: el mismo esquema que D1 (geo/schema.sql)
data/geo-assets/              4. archivos derivados: capas raster y vectoriales por país
```

`geo.db` se **reconstruye entero** en cada `geo build` (a un archivo temporal que
luego reemplaza al anterior): es determinista y no necesita migraciones locales.

## Dónde vive cada cosa en producción

| Qué | Dónde | Por qué |
|---|---|---|
| Usuarios, progreso, favoritos | Neon (Postgres) + Better Auth | escritura por usuario, transacciones |
| Geografía (entidades, datos, relaciones) | Cloudflare D1 `geomastery-geo` | solo lectura, SQLite = mismo esquema que local, junto al Worker |
| Fotos, capas raster, vectores por país | R2 `geoguesser` | archivos grandes e inmutables |
| API | Worker (mismo código que el servidor de desarrollo) | |

Prefijos en R2: `img/`, `thumb/` (fotos) · `atlas/layers/<capa>/<cc>.webp` ·
`atlas/vector/<cc>.json` (en desarrollo, Vite los sirve desde `data/geo-assets/`).

## Modelo

- **entity**: cualquier cosa con nombre en el mapa. `id` = QID de Wikidata si lo
  tiene; si no, `<esquema>:<id>` (`gn:3530597`, `gvp:345020`, `gmba:11085`, `ucdb:154`, `hp:<hash>`).
- **entity_name**: nombres por idioma (búsqueda; tabla FTS5 `entity_fts`).
- **entity_xref**: identificadores externos (`wd`, `gn`, `gvp`, `gmba`, `ne`, `iso`,
  `hylak`, `ucdb`…). Unir fuentes = buscar por xref, nunca por nombre si hay id.
- **fact**: un dato medido. `(entity, key, scope, source)` → valor numérico o texto,
  unidad y año. `scope` distingue lo que no es comparable:
  `population` con scope `city` (municipio/ciudad), `urban` (centro urbano GHSL,
  comparable entre países), `metro` (zona metropolitana oficial), `admin` (región).
  Los repartos de terreno también son facts, en países y regiones admin1:
  `landform:montana@share`, `landcover:cultivo@share`, `climate:Cfa@share`,
  `relief:mean@m`, `crops:maiz@tonnes`, `crops:maiz@ha`, `crops:cafe@share`.
- **relation**: `subject —predicate→ object`: `in_country`, `in_admin1`, `in_urban`,
  `center_of` (ciudad principal de un área urbana), `in_range`, `part_of`.
- **entity_sort**: índice de ordenación, un valor por entidad y dato (la población, la del
  ámbito de su tipo según `geo/kinds.json` → `populationScope`). La API ordena con él.
- **entity_tag**: etiquetas de filtro (`unesco`, `admin1`, `capital`, `activo`,
  `estratovolcan`, `embalse`, `cordillera_principal`…).
- **country**: continente, bandera y si tiene guía de GeoGuessr.
- **entity_hint**: qué pistas de GeoGuessr nombran cada entidad.
- **layer** y **asset**: capas de mapa (leyenda, fuente) y qué archivo hay de cada
  capa para cada país (ruta en R2, caja geográfica, tamaño).
- **source**: licencia y atribución de cada fuente; la app genera los créditos de aquí.

Una ciudad que también es región admin1 (Budapest, Berlín, Debrecen) es `city`
con la etiqueta `admin1`. Los tipos y sus familias están en `geo/kinds.json`
(lo leen el pipeline y la app).

Tipos (`kind`): `country`, `admin1`, `urban`, `city`, `town`, `volcano`, `mountain`,
`range`, `plain`, `plateau`, `desert`, `basin`, `river`, `lake`, `waterfall`,
`island`, `peninsula`, `national_park`, `forest`, `heritage`, `monument`, `landmark`,
`temple`, `church`, `mosque`, `castle`, `palace`, `archaeological`, `bridge`, `other`.

## Pipeline

```
npm run pipeline -- geo build                          reconstruye data/geo.db (~5 min)
npm run pipeline -- geo download wikidata-enrich       fama, fotos, artículos y población de regiones (caché)
npm run pipeline -- geo download wikipedia             resúmenes de los artículos nuevos (caché)
npm run pipeline -- geo download resolve               nombres en español de las ecorregiones (DeepSeek, caché)
npm run pipeline -- geo layers [capa…] [--countries mx,ch] [--no-stats] [--no-render]
npm run pipeline -- geo publish [d1|r2|community|worker] [--dry] [--full]   sin nada: todo
```

Orden tras añadir una fuente: `geo build` → `geo download wikidata-enrich` →
`geo download wikipedia` → `geo build` → `export` (las pistas enlazan sus lugares
por el xref `hp`).
Requisitos: GDAL (`brew install gdal`). Los intermedios regenerables están en
`data/geo-work/` (se puede borrar); lo publicable, en `data/geo-assets/`.

```
pipeline/geo/
  index.mjs        etapas; SOURCES = orden de ingesta (= prioridad)
  store.mjs        GeoStore: esquema, upserts, unión por xref, índices derivados
  derive.mjs       tras todas las fuentes: fundir duplicados (hp: sin id), área urbana ← su
                   ciudad principal, región admin1 de cada lugar
  publish.mjs      SQL para D1 y subida a R2 (solo lo que cambió)
  sources/*.mjs    una fuente = { meta, download?(ctx), ingest(store, ctx) }
  layers/*.mjs     una capa   = { id, family, name, kind, legend, source, prepare(), stats?(), render?(frame) }
  layers/grid.mjs  rejillas globales y zonas para los repartos por país y región
  layers/render.mjs  marco de cada país (Mercator, recorte) e imagen WebP
  lib/             descargas, GDAL, geometría, carpetas
geo/schema.sql     esquema único (pipeline y D1)
geo/kinds.json     tipos, familias y alias
worker/src/geo/    API: manejadores puros sobre un adaptador de base de datos
src/lib/geo.ts     cliente tipado de la API (+ hooks)
src/components/geo/  tarjetas, selector de país, CountryAtlas, CountryTerrain
```

Los manejadores de la API reciben `{ all(sql, params), first(sql, params) }`: en el
Worker es D1 y en `npm run dev` es `node:sqlite` sobre `data/geo.db` (plugin de
Vite). La app siempre llama a `/api/geo/…` (en el build, a `VITE_API_BASE` o
`VITE_IMAGE_BASE`, con la clave `VITE_IMAGE_KEY`).

### Capas

| Capa | Imagen por país | Repartos | Fuente |
|---|---|---|---|
| `vector` | contorno, estados, cordilleras, llanuras, ríos y lagos (TopoJSON) | — | Natural Earth, GMBA, HydroSHEDS |
| `relief` | sombreado con tintes de altitud | altitud media y máxima | ETOPO 2022 (15″ países pequeños, 60″ grandes) |
| `landform` | llanura, meseta, lomerío, montaña, alta montaña | % de cada clase | derivado de ETOPO (altitud + desnivel local) |
| `landcover` | bosque, matorral, pastizal, cultivos, ciudades… | % de cada clase | ESA WorldCover 2021 (remoto, vistas reducidas) |
| `crops` | grupo de cultivos dominante | toneladas y ha de 42 cultivos, % por grupo | MapSPAM 2020 si está en `data/raw/mapspam`, si no 2010 |
| `biome` | 14 biomas (selva, sabana, taiga, desierto…) | % de cada bioma | RESOLVE Ecoregions 2017 |
| `climate` | tipos de Köppen | % de cada tipo y grupo (A–E) | Beck et al. 2023, 1991–2020 |

Las imágenes están en Mercator (EPSG:3857) con la caja `asset.bbox`: en la app,
`d3.geoMercator` ajustado a esa caja las alinea exactamente con los vectores.
MapSPAM 2020 pide un formulario en Dataverse: si lo descargas, deja
`spam2020V2r2_global_production.geotiff.zip` y `spam2020V2r2_global_harvested_area.geotiff.zip`
en `data/raw/mapspam/` y repite `geo layers crops`.

## Guías de GeoGuessr: qué se descarga y cómo se guarda

La regla: **lo que se ve entero va como archivo con huella; lo que se consulta a trozos,
por la API**.

| Qué | Dónde | Cómo lo pide la app |
|---|---|---|
| Guía de cada país (pistas, grupos, atributos) | R2 `community/country/<cc>.<huella>.json` | entera, una vez (caché permanente) |
| Objetos de meta de cada país (+ rasgos) | R2 `community/objects/<cc>.<huella>.json` | la guía carga el suyo y los de sus 2 gemelos |
| Países, categorías, mapas temáticos, duelos | R2 `community/…` | enteros, una vez |
| Objetos de todo el mundo (Buscar) | R2 `community/meta-objects.<huella>.json` | entero (≈150 KB comprimido) |
| Fotos del explorador (45.000) | D1 `gg_photo` → `GET /api/gg/visual` | páginas de 60 + facetas |
| Preguntas de Entrenar (27.000) | D1 `gg_quiz` → `POST /api/gg/quiz` | solo las de la sesión (repaso y nuevas, con tu progreso) |
| Capas del mapa de cada país | R2 `atlas/…?v=<huella>` | una vez (caché permanente) |

`community/manifest.json` (caché de 1 minuto) traduce cada ruta a su versión con huella:
al publicar solo cambian los archivos modificados, y el navegador no vuelve a descargar
nada que ya tenga. Todo sale comprimido con brotli por Cloudflare.

```
npm run pipeline -- export                  public/community (los JSON de la app)
npm run pipeline -- geo guides              tablas gg_* de data/geo.db (sin reconstruirla)
npm run pipeline -- geo publish d1 community   D1 y R2 (community/ con huella y manifiesto)
```

Las claves de `gg_quiz` son las del progreso del usuario (`t:<id>`, `p:<id>:<imagen>`):
cambiar de cómo se elige no hace perder el repaso. Con usuarios en Neon, la sesión podrá
leer el progreso en el servidor en lugar de recibirlo en el cuerpo.

### Publicar en D1 sin gastar escrituras

D1 gratis permite 100 000 filas escritas al día y la base tiene ~3,3 M. Tras cada
publicación se guarda una copia de lo publicado (`data/geo-work/d1-published.db`); la
siguiente compara tabla a tabla (`EXCEPT`) y envía solo las filas nuevas (`INSERT`), las
cambiadas (`UPDATE` de las columnas que cambian: D1 cobra cada índice que toca, y un
`INSERT OR REPLACE` en `entity` cuesta 6 escrituras) y las borradas (`DELETE`). Si cambia el esquema, o con `--full`,
se borra y recarga todo. Con `--dry` se ve cuántas filas iría a escribir.

### Caché en el navegador (PWA)

La app se instala como PWA (`vite-plugin-pwa`, ver `vite.config.ts`): JS, CSS y fuentes
quedan precacheados. Lo que lleva huella o versión (API `?v=`, capas `?v=`,
`community/<ruta>.<hash>.json`) se guarda cache-first: nunca cambia, una publicación nueva
trae otras URLs. `community/manifest.json` va red primero, con caché sin conexión.

## Fuentes

| Fuente | Aporta | Licencia |
|---|---|---|
| Wikidata / Wikipedia | identidad, nombres, fotos, datos, resúmenes | CC0 / CC BY-SA |
| Natural Earth | países, regiones admin1, llanuras, mesetas, desiertos | dominio público |
| Atlas propio (`atlas`) y pistas (`hints`) | lugares de Wikidata elegidos y los que citan las pistas | — |
| GeoNames | todas las ciudades > 1.000 hab. y sus regiones | CC BY 4.0 |
| GHSL UCDB 2024 | centros urbanos con población comparable | CC BY 4.0 (JRC) |
| Smithsonian GVP | volcanes: tipo, estado, última erupción | uso con cita |
| HydroLAKES / HydroRIVERS | lagos medidos, red de ríos | HydroSHEDS (libre, con cita) |
| GMBA Mountain Inventory v2 | cordilleras (polígonos y jerarquía) | libre, con cita |
| ETOPO 2022 (NOAA) | relieve | dominio público |
| ESA WorldCover | vegetación y usos del suelo | CC BY 4.0 |
| MapSPAM 2020 v2 (o 2010) | 46 cultivos | CC BY 4.0 |
| Köppen-Geiger (Beck 2023) | clima | CC BY 4.0 |
| RESOLVE Ecoregions 2017 | 846 ecorregiones y 14 biomas | CC BY 4.0 |
| Natural Earth (marino) | mares, golfos, bahías y estrechos | dominio público |
