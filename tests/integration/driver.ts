// What differs between the two drivers the integration tests run on: PGlite by default,
// postgres.js in the CI Postgres job (TEST_POSTGRES_URL, see tests/postgres-setup.ts).
export const onPostgres = Boolean(process.env.TEST_POSTGRES_URL);

export { sqlRows } from "@/server/db/dump";
