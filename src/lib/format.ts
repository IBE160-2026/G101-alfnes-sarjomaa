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

// Review's counts: one copy, so cards, headings and announcements always read alike.
export const people = (n: number) => (n === 1 ? "1 person" : `${n} personer`);
export const groups = (n: number) => (n === 1 ? "1 gruppe" : `${n} grupper`);
