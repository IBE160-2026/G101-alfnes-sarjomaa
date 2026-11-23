// The one demo login (AD-19): seeded by `npm run demo`, printed on start, shown on `/`,
// `/logg-inn` and in the README. On the reserved .test domain, so it can never be a real address.
export const DEMO_HOST = {
  email: "demo@toppsvar.test",
  password: "demo-passord",
} as const;
