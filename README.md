# ◈ GeoMastery

Academia personal de aprendizaje geográfico para llegar a nivel avanzado en GeoGuessr.
No es un clon del juego ni una colección de enlaces: es un sistema de estudio que organiza,
relaciona y pone a prueba el conocimiento necesario para reconocer países y regiones desde
Street View.

## Ejecutar

```bash
npm install
npm run dev        # abre http://localhost:5173
```

`npm run build` genera la versión estática en `dist/` (servible con `npm run preview`).

No hay backend: todo corre en local y el progreso personal se guarda en `localStorage`
(exportable e importable como JSON desde el Panel).

## Vistas

La app lee la base de conocimiento que genera el pipeline (ver abajo); sin `npm run
pipeline` no tiene datos. La navegación sigue el plan de estudio (marco StoryBrand: el
jugador es el héroe, la app el guía, un plan de 3 pasos y una acción clara):

| Vista | Ruta | Para qué |
|---|---|---|
| **Inicio** | `/` | El problema, el plan en 3 pasos y tu siguiente acción |
| **Países** | `/paises` → `/pais/:code` | Lista o **mapa mundial** (`?vista=mapa`). Guía de cada país: datos globales, "se confunde con", **lo esencial** (cada pista lleva a su tema), y un tema por objeto (bolardos, líneas, matrículas…) con su perfil, sus pistas y fotos con nombre. Cada pista muestra cuántas fuentes la confirman y su texto en cada fuente |
| **Mapas** | `/mapas` | 26 mapas interactivos, uno por rasgo de la meta (lado de conducción, escritura, líneas, matrículas, bolardos, chevrones, cámaras…): colores reales, leyenda que aísla cada valor y marca los raros, rayas para países con varios valores |
| **Identificar** | `/identificar` | Búsqueda inversa: marcas lo que ves (bolardo, líneas, matrícula…) y te dice qué países encajan, avisando de los rasgos exclusivos |
| **Comparar** | `/comparar` | 2–4 países lado a lado con los rasgos que cambian resaltados, lo que dicen las fuentes de su parecido, y el mapa mundial de rasgos comunes y exclusivos |
| **Explorar fotos** | `/explorar` | Todas las imágenes por categoría, región, país y fuente |
| **Entrenar** | `/entrenar` | Preguntas de pistas (con el país oculto), fotos y lugares; distractores de países que se confunden de verdad; repetición espaciada SM-2 |
| **Fuentes** | `/fuentes` | Procedencia, método de extracción y licencias |

El idioma de las pistas (ES/EN) se cambia en la barra lateral. Las vistas de la primera
versión (fichas escritas a mano, Atlas, Laboratorio, Ruta…) están en [legacy/](legacy/),
fuera de la compilación.

## Pipeline de conocimiento (solo uso personal)

Toda la meta de las fuentes se concentra en una base SQLite local con un único comando:

```bash
npm run pipeline                              # todo: países → fuentes → deduplicar → exportar → informe
npm run pipeline -- extract geotips plonkit   # solo esas fuentes
npm run pipeline -- dedup                     # reagrupar pistas repetidas
npm run pipeline -- export                    # regenerar los JSON de la app
npm run pipeline -- report                    # informe en data/REPORT.md
npm run pipeline -- images [--retry] [--slow] # copia propia de las imágenes (WebP)
npm run pipeline -- upload                    # sube data/images al bucket R2 privado
# añade --refresh para volver a descargar en vez de usar la caché
```

Tres capas:

1. **Crudo** (`data/raw/<fuente>/`): cada página o respuesta de API tal como se descargó.
   Reprocesar no vuelve a descargar nada.
2. **Pistas normalizadas** (`data/geomastery.db`, tabla `hints` + `hint_images`): cada
   consejo de cada fuente con la misma forma (país, región, categoría de una taxonomía
   única, texto en su idioma original, imágenes, ubicación, fuente, url). Re-extraer
   actualiza en sitio y conserva los ids.
3. **Conocimiento**: `countries` (base global: población, capital, idiomas, monedas,
   prefijos, dominios, lado de circulación, fronteras; de datos abiertos) y `attributes`
   (datos estructurados país → valor, p. ej. generación de cámara o tipo de postes de nieve).

| Fuente | Cómo se extrae |
|---|---|
| Plonk It | JSON embebido en cada guía (`__PRELOADED_DATA__`) |
| GeoTips | HTML de páginas regionales, bloque por país del mapa interactivo |
| Geometas | API JSON pública por país |
| GeoHints | HTML de `/meta/*`: fotos, mapas de datos y listas |
| Learnable Meta | `/api/maps` + `__data.json` de cada mapa (formato devalue) |
| OpenGuessr Education | Fuentes Svelte del repositorio público en GitHub |
| Base de países | mledoze/countries (ODbL) + Wikidata (CC0) |

**Deduplicación** ([pipeline/dedup.mjs](pipeline/dedup.mjs)): agrupa en `clusters` las
pistas del mismo país que dicen lo mismo, comparando grupos de 3 palabras. Dos textos solo
se unen si los **datos distintivos** del más corto (números, nombres propios, códigos de
carretera, términos entre comillas, sufijos) están en el otro, porque muchas metas son
plantillas que solo cambian en ese dato ("Phone Code 12…" / "Phone Code 67…"). Cada grupo
tiene una pista canónica, sus fuentes y su nivel según los mapas de Learnable Meta
(1 imprescindible … 4 experto). Detecta copias literales, no paráfrasis.

**Paráfrasis con DeepSeek** ([pipeline/semantic.mjs](pipeline/semantic.mjs), de pago):

```bash
npm run pipeline -- semantic                  # deepseek-flash, todas las listas
npm run pipeline -- semantic --limit 20       # prueba pequeña
```

Necesita `DEEPSEEK_API` en `.env` (ignorado por git). Para cada país y categoría manda al
modelo las pistas de GeoTips, Geometas y OpenGuessr, que parafrasean, junto con sus 10
candidatas más parecidas del resto, y guarda en `semantic_links` qué textos dicen lo mismo.
Usa `deepseek-flash` sin modo de razonamiento: en la prueba fue más preciso que
`deepseek-v4-pro` (que juntaba datos distintos del mismo objeto) y diez veces más barato que
con razonamiento. Cada respuesta se guarda en `data/llm-cache/`, así que repetir no vuelve a
cobrar. La primera pasada completa (896 listas) costó 0,16 USD.

**Revisión de calidad con DeepSeek** ([pipeline/review.mjs](pipeline/review.mjs), de pago):

```bash
npm run pipeline -- review                    # todas las pistas canónicas sin revisar
npm run pipeline -- review --limit 200        # muestra aleatoria de prueba
```

Revisa la pista canónica de cada grupo (y las que no tienen país) en lotes de 25, y guarda
en `hint_review`: categoría y subcategoría corregidas, región concreta (Hokkaido, Bahía,
Kruger National Park…), país si faltaba, calidad (`ok` / `junk` / `global`) y utilidad
(3 determinante · 2 útil · 1 detalle). Las secciones de GeoTips que solo repiten la base
global (bandera, capital, dominio) se marcan por regla, sin pagar. La revisión se guarda
aparte de la extracción, así que re-extraer no la borra, y prevalece sobre la clasificación
por reglas. Solo se reenvían pistas nuevas o revisadas con una versión anterior de las
instrucciones (`PROMPT_VERSION`). La exportación deja fuera los grupos `junk` y `global`.

**Traducción español + inglés** ([pipeline/translate.mjs](pipeline/translate.mjs), de pago):

```bash
npm run pipeline -- translate                 # todos los textos canónicos útiles
npm run pipeline -- translate --limit 50      # prueba
```

Traduce el texto canónico de cada grupo útil (las copias del grupo dicen lo mismo) y guarda
ambas versiones en `hint_translations`. El original nunca se modifica; si ya estaba en
inglés, la versión inglesa es el original. Usa un glosario fijo (bollard → bolardo,
Google car → coche de Google…) y conserva nombres propios, palabras locales, códigos de
carretera y números. Las fichas de país exportadas incluyen `text_es` y `text_en`.

**Atributos de meta y comparación entre países** ([pipeline/attributes.mjs](pipeline/attributes.mjs), de pago):

```bash
npm run pipeline -- attributes                # todos los países y tipos de objeto
npm run pipeline -- attributes --countries hu,hr --categories bollards   # prueba
node pipeline/run.mjs find bollard body_color=white front_reflector_color=red back_reflector_color=white
node pipeline/run.mjs find chevron background_color=blue arrow_color=yellow
```

Convierte la prosa en objetos con rasgos de vocabulario cerrado
([pipeline/lib/meta-schema.mjs](pipeline/lib/meta-schema.mjs)): bolardos, líneas viales,
matrículas, postes, chevrones, señales de advertencia y de stop, traseras de señales, coche
de Google y guardarraíles. Cada objeto tiene variante (principal, regional, especial o
antigua), región y detalles libres, más las relaciones que dicen los textos: "también en"
y "se confunde con" (con la diferencia). Después, sin modelo, calcula cuántos países tiene
cada rasgo (`trait_stats`: comunes frente a exclusivos) y qué objetos de otros países
comparten diseño (`object_matches`: al menos la mitad de los rasgos del esquema, sin
contradicciones). `find` es la búsqueda inversa: dado lo que ves, qué países son
compatibles. Se exporta a `public/community/meta-objects.json`. "Exclusivo" significa
exclusivo entre los países de los que hay datos.

`npm run pipeline -- verify` ([pipeline/verify.mjs](pipeline/verify.mjs)) revisa los rasgos
raros (de 1 o 2 países), que es donde más se equivoca la extracción y lo que más vale en
partida: manda cada rasgo con sus textos de origen y pregunta si el texto lo dice de verdad.
Los falsos se corrigen o se borran (`trait_checks` guarda el veredicto y el motivo) y se
recalcula qué es común y qué es exclusivo, repitiendo hasta que no quede ningún rasgo raro
sin verificar. En la primera pasada: 94 revisados, 77 confirmados, 7 corregidos y 10
eliminados (por ejemplo, la "línea exterior negra" de Argentina era el contorno de un cartel).

El código está en [pipeline/](pipeline/): un adaptador por fuente en `pipeline/sources/`
y la taxonomía en `pipeline/lib/taxonomy.mjs`. Si una fuente usa un nombre de país que no
se resuelve, el comando lo lista; se arregla añadiendo un alias en `pipeline/lib/countries.mjs`.

`data/` y `public/community/` están **fuera de git**: el contenido de estas fuentes no
tiene licencia de reutilización, así que se queda en tu máquina con atribución y enlace
al original. **No publiques ni redistribuyas esas carpetas.** Las descargas van despacio a
propósito y reintentan ante HTTP 429.

### Imágenes propias

`images` descarga cada imagen una vez, la identifica por el hash de su contenido (una foto
subida por varias fuentes se guarda una sola vez) y la convierte a WebP:
`data/images/img/ab/<sha1>.webp` (1600 px) y `thumb/ab/<sha1>.webp` (480 px). La tabla
`image_files` guarda URL original → hash, medidas y estado; se puede interrumpir y reanudar.
Plonk It bloquea durante ~26 min las peticiones que llegan a su servidor, pero no las que
sirve la caché de Cloudflare: se pide su versión `/images/resize/1920/80/…`, que casi
siempre está en caché.

`export` escribe las rutas propias (`/images/…`) y la app las resuelve en
[src/lib/images.ts](src/lib/images.ts): en local las sirve Vite desde `data/images`; en la
versión remota, el Worker de [worker/](worker/), que lee el bucket R2 privado y solo responde
con la clave (`VITE_IMAGE_BASE` y `VITE_IMAGE_KEY` en `.env.production`). `upload` sube a R2
lo que falta (credenciales `CLOUDFLARE_ACCOUNT_ID`, `R2_*` en `.env`).

### Mapas temáticos

[pipeline/maps.mjs](pipeline/maps.mjs) genera `maps.json`: una capa por rasgo, con el valor
de cada país, a partir de la base de países (lado de conducción, idiomas → escritura), los
atributos de GeoHints (líneas, cámaras, años, nieve) y los objetos de meta.

Las imágenes de lugares (preguntas de Entrenar) vienen de la API de Wikipedia (CC BY-SA,
atribuidas en la propia tarjeta).

### Base geográfica y mapas de terreno

Geografía (volcanes, ríos, ciudades, cordilleras, llanuras…) y el mapa de terreno de
cada país (relieve, llanuras y montañas, vegetación, cultivos y clima) salen de
`data/geo.db`, con el mismo esquema que la base D1 de producción. Contrato completo
(modelo, fuentes, capas, API, publicación) en [docs/geo.md](docs/geo.md).

```bash
brew install gdal                                  # una vez
npm run pipeline -- geo build                      # data/geo.db (~5 min)
npm run pipeline -- geo download wikidata-enrich   # fama, fotos y artículos (caché)
npm run pipeline -- geo layers                     # repartos e imágenes por país (largo)
npm run pipeline -- export                         # las pistas enlazan sus lugares
npm run pipeline -- geo publish                    # D1 (incremental) + R2 + Worker
npm run release                                    # lo anterior y el build de la app
```

## Publicación y cuentas

La app publicada vive entera en el Worker de Cloudflare
(`https://geoguesser-images.luis-e.workers.dev`): sirve `dist/` y, en el mismo origen, la API
(D1), las fotos y capas (R2) y las cuentas (`/api/auth`, Better Auth sobre Neon). Sin sesión
solo se ve la pantalla de acceso; pueden crear cuenta los correos de `ALLOWED_EMAILS`.

| En `.env` | Para |
|---|---|
| `DATABASE_URL` | Neon (Postgres de las cuentas) |
| `ALLOWED_EMAILS` | correos invitados, separados por comas |
| `BETTER_AUTH_SECRET` | firma de las cookies de sesión |
| `VITE_IMAGE_KEY` | clave de herramientas (`ACCESS_KEY` del Worker; nunca va en la build) |
| `CLOUDFLARE_*`, `R2_*` | desplegar y subir a R2 |

```bash
node worker/scripts/migrate.mjs        # tablas de Better Auth en Neon (una vez, o al actualizarlo)
npm run pipeline -- geo publish secrets     # secretos del Worker desde .env (al cambiarlos)
npm run release                             # build + D1 + R2 + Worker
```

Para invitar a alguien: añade su correo a `ALLOWED_EMAILS` y `npm run pipeline -- geo publish secrets`.

## Mi estudio y repetición espaciada

Con ☆ Guardar (en cada pista, foto del explorador y lugar de Geografía) o **Estudiar lo
esencial** / **Estudiar este tema** en la guía de un país, lo que quieras aprender va a
**Entrenar → Mi estudio**, organizado en mazos propios y con notas. Cada guardado da varias
tarjetas ([src/lib/study/cards.ts](src/lib/study/cards.ts)):

- **reconocer**: la pista, la foto o el lugar → ¿de qué país es? (distractores con los países
  con los que se confunde y, primero, con los que tú lo confundes)
- **recordar**: «Hungría · bolardos: ¿cómo son?» → lo piensas, lo ves y te puntúas
- **ubicar**: «¿dónde está Debrecen?» → tocas el mapa y cuenta la distancia (la tolerancia
  depende del tamaño del lugar)
- **Street View**: la vista del ejemplo de una pista (con la dirección tapada) → ¿en qué país estás?
- **gemelos**: dos fotos del mismo tema, una de cada país del duelo → ¿cuál es cuál?

Se guarda también en bloque: lo esencial de un país, un tema, hasta 120 fotos de Explorar
(repartidas entre países) o una lista de Geografía. Hay mazos automáticos (lo que más fallas,
determinantes, gemelos), atajos de teclado (1–4 y espacio), un **examen** por país (20
preguntas contra el reloj que no tocan el repaso, con historial de notas), tu progreso dentro
de la guía de cada país y en cada pista, y estadísticas de actividad, dominio por tema y
velocidad. La app instalada muestra los pendientes en su icono.

El repaso usa **FSRS** (el algoritmo de Anki, vía `ts-fsrs`,
[src/lib/study/fsrs.ts](src/lib/study/fsrs.ts)): programa cada tarjeta para cuando la
probabilidad de recordarla baja al 90 %. El progreso de la versión SM-2 se migró
conservando lo aprendido. Mi estudio muestra lo de hoy, la racha, el objetivo diario, la
previsión de la semana, el dominio por país en el mapa y las parejas de países que confundes
(con enlace al duelo).

Todo vive primero en el dispositivo (IndexedDB, [src/lib/study/store.ts](src/lib/study/store.ts))
y se sincroniza con tu cuenta en segundo plano (`POST /api/me/sync`, Neon,
[worker/src/me.js](worker/src/me.js) y [worker/src/db/study.sql](worker/src/db/study.sql)):
funciona sin conexión y en varios dispositivos; gana el cambio más reciente.

`npm test` prueba la lógica del estudio (FSRS y su migración, sesiones, estadísticas, la mezcla
entre dispositivos) y la validación del servidor.

## Procedencia y licencias

El código de este repositorio es propio. El contenido importado (textos e imágenes de
Plonk It, GeoTips, Geometas, GeoHints, Learnable Meta y OpenGuessr) es **solo para uso
personal**: vive en `data/`, `public/community/` y el bucket privado, nunca en el repo, y
cada pista enlaza a su original. El detalle de cada fuente está en
[docs/FUENTES.md](docs/FUENTES.md) y en la app en `/fuentes`.

## Stack

Vite + React 18 + TypeScript (estricto) + React Router (hash) · d3-geo + world-atlas para
los mapas · SQLite nativo de Node para el pipeline · sharp para las imágenes · Cloudflare R2
+ Worker para servirlas fuera de local. Fuentes tipográficas auto-alojadas (Fraunces,
Archivo, IBM Plex Mono). Sin cuentas ni telemetría.
