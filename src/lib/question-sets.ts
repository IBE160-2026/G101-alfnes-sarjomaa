import { z } from "zod";
import { createGameSchema } from "@/lib/game";
// eslint-disable-next-line no-restricted-imports -- data/ sits outside src, so @/ cannot reach it.
import data from "../../data/question-sets/protoqa-nb.json" with { type: "json" };

// FR-33: the ready-made Question sets, translated from ProtoQA (data/protoqa/ATTRIBUTION.md).
// Server only: the create form gets just {id, name}, so the JSON stays out of the client bundle.
export const QUESTION_SETS = data.sets;

export const QUESTION_SET_CREDIT =
  "Spørsmål fra ProtoQA (CC BY 4.0), oversatt og tilpasset";

export const createFromSetSchema = createGameSchema.extend({
  questionSet: z
    .string()
    .refine(
      (id) => QUESTION_SETS.some((set) => set.id === id),
      "Velg et sett fra lista.",
    ),
});
