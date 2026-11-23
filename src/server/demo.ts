import "server-only";
import { randomUUID } from "node:crypto";
import { DEMO_HOST } from "@/lib/demo";
import { newToken } from "@/lib/token";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { closeDb } from "@/server/db/client";
import * as games from "@/server/games";
import * as questions from "@/server/questions";

// Invented for the demo (§6.1): no real person and nothing from .idea/.
// data/rulings/demo.json partitions exactly these Answers.
export const DEMO_TITLE = "Hyttetur med gjengen";
export const DEMO_QUESTIONS = [
  "Hva må være med på hytteturen?",
  "Hva spiser dere til frokost på hytta?",
  "Hva gjør dere når det regner på hytta?",
];
// One entry per Answer set, one list per Question in DEMO_QUESTIONS order.
export const DEMO_SETS = [
  [
    ["Kaffe", "Kortstokk", "Ullsokker"],
    ["Brunost", "Egg"],
    ["Ser film", "Brettspill"],
  ],
  [
    ["kaffe", "Kortspill"],
    ["Geitost", "Vafler"],
    ["Filmkveld", "Spiller kort"],
  ],
  [
    ["Kaffe!", "Varme sokker", "Sjokolade"],
    ["Brunost", "Grøt"],
    ["Brettspill", "Leser bok"],
  ],
  [["Ullsokker", "Kaffe"], ["Egg og bacon", "Brunost"], ["Ser film"]],
  [
    ["Sovepose", "Kortstokk"],
    ["Havregrøt", "Kaffe"],
    ["Spiller kort", "Sover"],
  ],
  [
    ["Kaffe", "Sjokolade", "Ullsokker"],
    ["Vafler", "Geitost"],
    ["Brettspill", "Kortspill", "Baker kake"],
  ],
];
// Eight links, six answered, so the Game page reads "6 av 8".
const DEMO_LINKS = 8;

// Through the module entry points only, as the app would (AD-19). Every link's Token
// stays in this function: nothing here prints a link, Token or Answer.
export async function seed(): Promise<{
  hostId: string;
  gameId: string;
  questionIds: string[];
}> {
  const { hostId } = await auth.createHost(DEMO_HOST);
  const { id: gameId } = await games.create(hostId, { title: DEMO_TITLE });
  const questionIds = DEMO_QUESTIONS.map(() => randomUUID());
  for (const [i, text] of DEMO_QUESTIONS.entries())
    await questions.save(hostId, { gameId, questionId: questionIds[i], text });
  const { links } = await collection.createInviteLinks(hostId, {
    gameId,
    count: DEMO_LINKS,
  });
  for (const [i, set] of DEMO_SETS.entries())
    await collection.submit(gameId, links[i].split("#")[1], {
      editSecret: newToken(),
      answers: Object.fromEntries(questionIds.map((id, q) => [id, set[q]])),
    });
  return { hostId, gameId, questionIds };
}

// For the CLI: the PGlite directory must be released before next dev opens it.
export async function seedAndClose(): Promise<void> {
  try {
    await seed();
  } finally {
    await closeDb();
  }
}
