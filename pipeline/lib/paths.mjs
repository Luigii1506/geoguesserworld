import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DATA_DIR = path.join(ROOT, 'data')
export const RAW_DIR = path.join(DATA_DIR, 'raw')
export const EXPORT_DIR = path.join(DATA_DIR, 'export')
