const DATE = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Oslo",
});

// "22. november 2026", always in Norwegian time whatever the server's zone.
export function formatDate(date: Date): string {
  return DATE.format(date);
}
