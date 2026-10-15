// Kysely sobre Neon por HTTP (@neondatabase/serverless): cada consulta es un fetch, sin
// conexión abierta. En un Worker eso importa: una conexión (WebSocket) no puede compartirse
// entre peticiones, así que con un Pool habría que crear la instancia de Better Auth en
// cada una. Por HTTP se crea una vez por isolate y se reutiliza.
// Sin transacciones interactivas: Better Auth funciona sin ellas (transaction: false).
import { neon } from '@neondatabase/serverless'
import { PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely'

export class NeonHttpDialect {
  /** @param {string} url  cadena de conexión de Neon (DATABASE_URL) */
  constructor(url) {
    this.sql = neon(url, { fullResults: true })
  }

  createAdapter() {
    return new PostgresAdapter()
  }

  createQueryCompiler() {
    return new PostgresQueryCompiler()
  }

  createIntrospector(db) {
    return new PostgresIntrospector(db)
  }

  createDriver() {
    const sql = this.sql
    const connection = {
      async executeQuery(query) {
        const r = await sql.query(query.sql, [...query.parameters])
        return { rows: r.rows, numAffectedRows: r.command === 'SELECT' ? undefined : BigInt(r.rowCount ?? 0) }
      },
      // eslint-disable-next-line require-yield
      async *streamQuery() {
        throw new Error('Neon por HTTP no admite streaming')
      },
    }
    const noTransactions = async () => {
      throw new Error('Neon por HTTP no admite transacciones interactivas')
    }
    return {
      init: async () => {},
      acquireConnection: async () => connection,
      beginTransaction: noTransactions,
      commitTransaction: noTransactions,
      rollbackTransaction: noTransactions,
      releaseConnection: async () => {},
      destroy: async () => {},
    }
  }
}
