// Base de conocimiento local (SQLite nativo de Node, sin dependencias).
//
// Capas:
//   documents  → registro de lo descargado en crudo (data/raw/)
//   countries  → base global de países (datos abiertos)
//   hints      → cada consejo de cada fuente, normalizado a una misma forma
//   hint_images
//
// Los hints se identifican por (source_id, source_key): re-extraer actualiza
// en sitio y conserva el id, de modo que el progreso de estudio no se rompe.

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './paths.mjs'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  homepage    TEXT,
  license     TEXT,
  method      TEXT,
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  url         TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL,
  path        TEXT NOT NULL,
  status      INTEGER,
  bytes       INTEGER,
  fetched_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS countries (
  code          TEXT PRIMARY KEY,   -- ISO 3166-1 alfa-2, minúsculas
  iso3          TEXT,
  name          TEXT NOT NULL,
  official_name TEXT,
  name_es       TEXT,
  region        TEXT,
  subregion     TEXT,
  capital       TEXT,
  lat           REAL,
  lng           REAL,
  area_km2      REAL,
  population    INTEGER,
  driving_side  TEXT,               -- 'left' | 'right'
  flag          TEXT,
  independent   INTEGER,
  landlocked    INTEGER,
  languages     TEXT,               -- JSON
  currencies    TEXT,               -- JSON
  calling_codes TEXT,               -- JSON
  tlds          TEXT,               -- JSON
  borders       TEXT,               -- JSON (códigos alfa-2)
  alt_names     TEXT,               -- JSON: nombres alternativos para resolver fuentes
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  grp         TEXT NOT NULL,
  ord         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hints (
  id              INTEGER PRIMARY KEY,
  source_id       TEXT NOT NULL,
  source_key      TEXT NOT NULL,
  url             TEXT,             -- página de origen
  country_code    TEXT,             -- NULL si no se pudo resolver o es global
  country_raw     TEXT,             -- nombre/código tal como venía en la fuente
  region          TEXT,             -- subdivisión, si la fuente la indica
  category        TEXT NOT NULL,    -- taxonomía propia (categories.id)
  subcategory     TEXT,
  category_method TEXT NOT NULL,    -- 'label' | 'tag' | 'text' | 'none'
  source_label    TEXT,             -- sección/etiqueta/categoría original
  title           TEXT,
  text            TEXT,             -- texto plano en su idioma original
  lang            TEXT NOT NULL DEFAULT 'en',
  location_url    TEXT,
  lat             REAL,
  lng             REAL,
  extra           TEXT,             -- JSON con datos propios de la fuente
  run_id          TEXT NOT NULL,
  first_seen      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (source_id, source_key)
);

CREATE INDEX IF NOT EXISTS hints_country  ON hints(country_code);
CREATE INDEX IF NOT EXISTS hints_category ON hints(category, subcategory);
CREATE INDEX IF NOT EXISTS hints_source   ON hints(source_id);

CREATE TABLE IF NOT EXISTS hint_images (
  hint_id     INTEGER NOT NULL REFERENCES hints(id) ON DELETE CASCADE,
  ord         INTEGER NOT NULL,
  url         TEXT NOT NULL,
  PRIMARY KEY (hint_id, ord)
);

-- Atributos de meta país → valor (p. ej. camera_generation = "Gen 4",
-- snow_poles = "Outdoor"). Datos estructurados de las fuentes, base para
-- generar comparaciones y preguntas por consulta.
CREATE TABLE IF NOT EXISTS attributes (
  source_id     TEXT NOT NULL,
  attribute     TEXT NOT NULL,
  country_raw   TEXT NOT NULL,
  value         TEXT NOT NULL,
  country_code  TEXT,
  region        TEXT,
  detail        TEXT,
  url           TEXT,
  run_id        TEXT NOT NULL,
  PRIMARY KEY (source_id, attribute, country_raw, value)
);
CREATE INDEX IF NOT EXISTS attributes_country ON attributes(country_code, attribute);

-- Recursos externos que recomiendan las fuentes: mapas de GeoGuessr para
-- practicar, guías y hojas de cálculo de la comunidad, mapas de Google…
CREATE TABLE IF NOT EXISTS resources (
  source_id     TEXT NOT NULL,
  country_code  TEXT,
  url           TEXT NOT NULL,
  title         TEXT,
  author        TEXT,
  kind          TEXT,               -- community_doc | practice_map | other
  run_id        TEXT NOT NULL,
  PRIMARY KEY (source_id, country_code, url)
);

CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  hints       INTEGER,
  removed     INTEGER,
  ok          INTEGER
);
`

export function openDb() {
  mkdirSync(DATA_DIR, { recursive: true })
  const db = new DatabaseSync(path.join(DATA_DIR, 'geomastery.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 15000;')
  db.exec(SCHEMA)
  return db
}

export function tx(db, fn) {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export const now = () => new Date().toISOString()
