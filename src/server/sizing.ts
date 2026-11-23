import "server-only";
import { seedGame } from "@/server/demo";

// The NFR-5 sizing Game for tests/manual/checklist.md (T1–T8, A6–A10). Invented: no real
// person and nothing from .idea/. On the reserved .test domain, like the demo login.
export const SIZING_HOST = {
  email: "storrelse@toppsvar.test",
  password: "storrelse-passord",
} as const;
const SIZING_TITLE = "Størrelsestest";
const QUESTIONS = 15;
const SETS = 30;
// A8: a 200-character Question (QUESTION_TEXT_MAX).
export const LONG_QUESTION =
  "Tenk deg at hele vennegjengen skal på en lang hyttetur på fjellet en hel uke midt på vinteren, uten strøm og uten nett: hva er det viktigste dere må huske å pakke ned i sekken før dere drar hjemmefra?";
// A9: a 40-character label of wide letters, ranked first in every other set so it tops
// Question 1's Board.
export const WIDE_ANSWER = `${"M".repeat(39)}Ø`;

// One list per Question in order: 1 to 5 Answers, the same spread as grouping.test.ts's
// sizing Game.
function sizingSet(s: number): string[][] {
  return Array.from({ length: QUESTIONS }, (_, q) => {
    const answers = Array.from(
      { length: 1 + ((s + q) % 5) },
      (_, f) => `Svar ${(s * 7 + f * 3 + q) % 40}`,
    );
    return q === 0 && s % 2 === 0
      ? [WIDE_ANSWER, ...answers].slice(0, 5)
      : answers;
  });
}

// Left in collecting, so the tester closes, reviews and plays through the UI they are timing.
export const seedSizing = () =>
  seedGame({
    host: SIZING_HOST,
    title: SIZING_TITLE,
    questions: Array.from({ length: QUESTIONS }, (_, q) =>
      q === 0 ? LONG_QUESTION : `Spørsmål ${q + 1}: nevn noe`,
    ),
    sets: Array.from({ length: SETS }, (_, s) => sizingSet(s)),
    links: SETS,
  });
