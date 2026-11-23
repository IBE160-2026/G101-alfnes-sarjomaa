// What differs between the two drivers the integration tests run on: PGlite by default,
// postgres.js in the CI Postgres job (TEST_POSTGRES_URL, see tests/postgres-setup.ts).
export const onPostgres = Boolean(process.env.TEST_POSTGRES_URL);

// db.execute returns { rows } on PGlite and the row array itself on postgres.js.
export const sqlRows = <T>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : (result as { rows: T[] }).rows;
