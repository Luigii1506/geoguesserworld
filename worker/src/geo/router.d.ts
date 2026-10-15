import type { GeoDb } from './api.js'
export function handleApi(db: GeoDb, url: URL, body?: string): Promise<{ status: number; body: unknown }>
