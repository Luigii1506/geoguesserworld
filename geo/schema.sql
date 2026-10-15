-- Esquema de la base geográfica (data/geo.db en local, D1 en producción).
-- Único punto de verdad: lo usan el pipeline (pipeline/geo/store.mjs) y las
-- migraciones de D1. Ver docs/geo.md.

CREATE TABLE IF NOT EXISTS source (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT,
  license     TEXT NOT NULL,
  attribution TEXT NOT NULL,
  version     TEXT,
  retrieved   TEXT
);

CREATE TABLE IF NOT EXISTS entity (
  id        TEXT PRIMARY KEY,   -- QID de Wikidata o <esquema>:<id>
  kind      TEXT NOT NULL,
  name      TEXT NOT NULL,      -- nombre para mostrar (español si existe)
  name_en   TEXT,
  cc        TEXT,               -- país principal (ISO alfa-2, minúsculas)
  ccs       TEXT,               -- todos sus países, separados por coma, si son varios
  admin1    TEXT,               -- id de su región admin1, si se conoce
  lat       REAL,
  lng       REAL,
  bbox      TEXT,               -- "oeste,sur,este,norte" si tiene extensión
  fame      INTEGER NOT NULL DEFAULT 0,  -- en cuántas Wikipedias tiene artículo
  rank      REAL NOT NULL DEFAULT 0,     -- importancia normalizada (0–1) para ordenar
  hints     INTEGER NOT NULL DEFAULT 0,  -- en cuántas pistas de GeoGuessr sale
  image     TEXT,
  thumb     TEXT,
  descr     TEXT,               -- descripción corta
  summary   TEXT,               -- resumen de Wikipedia
  wiki      TEXT,               -- URL del artículo
  wiki_lang TEXT,
  tags      TEXT                -- etiquetas para filtrar, separadas por coma (unesco,activo,estratovolcan…)
);
CREATE INDEX IF NOT EXISTS entity_kind ON entity(kind, rank DESC);
CREATE INDEX IF NOT EXISTS entity_cc ON entity(cc, kind, rank DESC);
CREATE INDEX IF NOT EXISTS entity_admin1 ON entity(admin1, kind);
CREATE INDEX IF NOT EXISTS entity_geo ON entity(lat, lng);
-- "con pistas de GeoGuessr": solo unos miles de lugares, índice parcial
CREATE INDEX IF NOT EXISTS entity_hints ON entity(hints) WHERE hints > 0;

-- todos los países de una entidad que cruza fronteras (para filtrar por país)
CREATE TABLE IF NOT EXISTS entity_country (
  entity_id TEXT NOT NULL,
  cc        TEXT NOT NULL,
  PRIMARY KEY (cc, entity_id)
) WITHOUT ROWID;

-- etiquetas de filtro normalizadas (las genera GeoStore.finish desde entity.tags)
CREATE TABLE IF NOT EXISTS entity_tag (
  tag       TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  PRIMARY KEY (tag, entity_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS entity_tag_entity ON entity_tag(entity_id);

-- países: continente y datos para el selector (una fila por código ISO)
CREATE TABLE IF NOT EXISTS country (
  cc        TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  name      TEXT NOT NULL,
  name_en   TEXT,
  continent TEXT,              -- Africa | Americas | Asia | Europe | Oceania | Antarctic
  subregion TEXT,
  flag      TEXT,
  guide     INTEGER NOT NULL DEFAULT 0,  -- 1 si tiene guía de GeoGuessr
  places    INTEGER NOT NULL DEFAULT 0   -- lugares (sin país ni regiones), lo calcula GeoStore.finish
);

CREATE TABLE IF NOT EXISTS entity_name (
  entity_id TEXT NOT NULL,
  lang      TEXT NOT NULL,      -- es, en, local, alt…
  name      TEXT NOT NULL,
  PRIMARY KEY (entity_id, lang, name)
) WITHOUT ROWID;

CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(
  entity_id UNINDEXED, names, tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS entity_xref (
  entity_id TEXT NOT NULL,
  scheme    TEXT NOT NULL,      -- wd, gn, gvp, gmba, ne, iso, hylak, ucdb, hp…
  value     TEXT NOT NULL,
  PRIMARY KEY (scheme, value)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS xref_entity ON entity_xref(entity_id);

CREATE TABLE IF NOT EXISTS fact (
  entity_id TEXT NOT NULL,
  key       TEXT NOT NULL,      -- population, elevation, length, area, discharge, cover:cropland…
  scope     TEXT NOT NULL DEFAULT '',  -- city | urban | metro | admin | share | tonnes…
  value     REAL,
  text      TEXT,
  unit      TEXT,
  year      INTEGER,
  source_id TEXT NOT NULL,
  PRIMARY KEY (entity_id, key, scope)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS fact_rank ON fact(key, scope, value DESC);

-- índice de ordenación: un valor por entidad y dato (la población, la del ámbito de su
-- tipo; el resto, el máximo). Lo genera GeoStore.finish; la API ordena con él.
CREATE TABLE IF NOT EXISTS entity_sort (
  key       TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  value     REAL NOT NULL,
  PRIMARY KEY (key, entity_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS entity_sort_value ON entity_sort(key, value DESC);

CREATE TABLE IF NOT EXISTS relation (
  subject   TEXT NOT NULL,
  predicate TEXT NOT NULL,      -- in_country, in_admin1, in_urban, in_range, part_of, flows_into, capital_of
  object    TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (subject, predicate, object)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS relation_object ON relation(object, predicate);

-- pistas de GeoGuessr que nombran cada entidad (ids de las pistas de la app)
CREATE TABLE IF NOT EXISTS entity_hint (
  entity_id TEXT NOT NULL,
  hint_id   TEXT NOT NULL,
  cc        TEXT,
  PRIMARY KEY (entity_id, hint_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS layer (
  id        TEXT PRIMARY KEY,   -- relief, landform, landcover, crops, climate…
  family    TEXT NOT NULL,      -- terreno | vegetacion | clima | agua
  name      TEXT NOT NULL,
  kind      TEXT NOT NULL,      -- raster | vector
  legend    TEXT NOT NULL,      -- JSON: [{ key, label, color }]
  source_id TEXT NOT NULL,
  ord       INTEGER NOT NULL DEFAULT 0
);

-- archivos de cada capa para cada país (en R2 bajo atlas/)
CREATE TABLE IF NOT EXISTS asset (
  layer_id  TEXT NOT NULL,
  cc        TEXT NOT NULL,
  path      TEXT NOT NULL,      -- atlas/layers/relief/mx.webp
  bbox      TEXT NOT NULL,      -- "oeste,sur,este,norte" (grados)
  width     INTEGER,
  height    INTEGER,
  bytes     INTEGER,
  hash      TEXT,
  PRIMARY KEY (cc, layer_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ── Guías de GeoGuessr (fuentes de la comunidad) ──
-- Lo que la app consulta a trozos en lugar de descargarlo entero: las fotos del
-- explorador visual y las preguntas de Entrenar. Lo llena la fuente "guides"
-- (pipeline/geo/sources/guides.mjs) desde lo que exporta `npm run pipeline -- export`.

CREATE TABLE IF NOT EXISTS gg_photo (
  id        INTEGER PRIMARY KEY,
  cc        TEXT,                 -- país (NULL si la fuente no lo indica)
  place     TEXT,                 -- nombre en crudo cuando no hay país
  src       TEXT NOT NULL,        -- letra de la fuente (p plonkit, g geometas, h geohints…)
  k         TEXT NOT NULL,        -- categoría (bollards, poles…)
  sk        TEXT,                 -- subcategoría
  text      TEXT,
  img       TEXT NOT NULL,
  link      TEXT,
  sort_name TEXT NOT NULL         -- país en español (o el nombre en crudo) para ordenar
);
CREATE INDEX IF NOT EXISTS gg_photo_k ON gg_photo(k, sort_name);
CREATE INDEX IF NOT EXISTS gg_photo_cc ON gg_photo(cc, k);

-- preguntas: la clave es la misma del progreso del usuario (t:<id> · p:<id>:<imagen>)
CREATE TABLE IF NOT EXISTS gg_quiz (
  key   TEXT PRIMARY KEY,
  kind  TEXT NOT NULL,            -- text | photo
  cc    TEXT NOT NULL,
  k     TEXT NOT NULL,
  sk    TEXT,
  u     INTEGER,                  -- utilidad (pistas de texto)
  data  TEXT NOT NULL             -- la pregunta en JSON (texto en es/en, imagen, región…)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS gg_quiz_scope ON gg_quiz(kind, k, cc);
CREATE INDEX IF NOT EXISTS gg_quiz_cc ON gg_quiz(cc);
