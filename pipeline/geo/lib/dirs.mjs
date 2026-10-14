// Carpetas de trabajo de la base geográfica (fuera de git, en data/).
import path from 'node:path'
import { DATA_DIR } from '../../lib/paths.mjs'

/** intermedios regenerables: conversiones a GeoJSON, rásters remuestreados… (se puede borrar) */
export const WORK = path.join(DATA_DIR, 'geo-work')
/** lo que se publica en R2 bajo atlas/: capas por país (WebP) y vectores (JSON) */
export const ASSETS = path.join(DATA_DIR, 'geo-assets')
