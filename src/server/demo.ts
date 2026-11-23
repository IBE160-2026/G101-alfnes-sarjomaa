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
const DEMO_TITLE = "Hyttetur med gjengen";
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

// Through the module entry points only, as the app would (AD-19). Shared by the demo and
// sizing seeds. Every link's Token stays in this function: nothing here prints a link,
// Token or Answer. Each set holds one list of Answers per Question, in order.
export async function seedGame(spec: {
  host: { email: string; password: string };
  title: string;
  questions: string[];
  sets: string[][][];
  links: number;
}): Promise<{ hostId: string; gameId: string; questionIds: string[] }> {
  const { hostId } = await auth.createHost(spec.host);
  const { id: gameId } = await games.create(hostId, { title: spec.title });
  const questionIds = spec.questions.map(() => randomUUID());
  for (const [i, text] of spec.questions.entries())
    await questions.save(hostId, { gameId, questionId: questionIds[i], text });
  const { links } = await collection.createInviteLinks(hostId, {
    gameId,
    count: spec.links,
  });
  for (const [i, set] of spec.sets.entries())
    await collection.submit(gameId, links[i].split("#")[1], {
      editSecret: newToken(),
      answers: Object.fromEntries(questionIds.map((id, q) => [id, set[q]])),
    });
  return { hostId, gameId, questionIds };
}

export const seed = () =>
  seedGame({
    host: DEMO_HOST,
    title: DEMO_TITLE,
    questions: DEMO_QUESTIONS,
    sets: DEMO_SETS,
    links: DEMO_LINKS,
  });

// For the CLIs: the PGlite directory must be released before next dev or the tester opens it.
export async function seedAndClose(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } finally {
    await closeDb();
  }
}
