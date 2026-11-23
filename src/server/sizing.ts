import "server-only";
import { randomUUID } from "node:crypto";
import { newToken } from "@/lib/token";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { closeDb } from "@/server/db/client";
import * as games from "@/server/games";
import * as questions from "@/server/questions";

// The NFR-5 sizing Game for tests/manual/checklist.md (T1–T8, A6–A10). Invented: no real
// person and nothing from .idea/. On the reserved .test domain, like the demo login.
export const SIZING_HOST = {
  email: "storrelse@toppsvar.test",
  password: "storrelse-passord",
} as const;
export const SIZING_TITLE = "Størrelsestest";
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
export function sizingSet(s: number): string[][] {
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

// Through the module entry points only, as the demo seed. Left in collecting, so the tester
// closes, reviews and plays through the UI they are timing. Nothing here prints a link.
export async function seedSizing(): Promise<{ gameId: string }> {
  const { hostId } = await auth.createHost(SIZING_HOST);
  const { id: gameId } = await games.create(hostId, { title: SIZING_TITLE });
  const questionIds = Array.from({ length: QUESTIONS }, () => randomUUID());
  for (const [q, questionId] of questionIds.entries())
    await questions.save(hostId, {
      gameId,
      questionId,
      text: q === 0 ? LONG_QUESTION : `Spørsmål ${q + 1}: nevn noe`,
    });
  const { links } = await collection.createInviteLinks(hostId, {
    gameId,
    count: SETS,
  });
  for (let s = 0; s < SETS; s++) {
    const set = sizingSet(s);
    await collection.submit(gameId, links[s].split("#")[1], {
      editSecret: newToken(),
      answers: Object.fromEntries(questionIds.map((id, q) => [id, set[q]])),
    });
  }
  return { gameId };
}

export async function seedSizingAndClose(): Promise<void> {
  try {
    await seedSizing();
  } finally {
    await closeDb();
  }
}
