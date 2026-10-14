// Tipos de los manejadores (api.js es JavaScript para que el Worker lo use tal cual).
export interface GeoDb {
  all(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>
  first(sql: string, params?: unknown[]): Promise<Record<string, unknown> | null>
}
export function handleGeo(db: GeoDb, url: URL): Promise<{ status: number; body: unknown }>
