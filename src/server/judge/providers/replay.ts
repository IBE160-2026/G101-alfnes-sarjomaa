import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { normalize, NORMALIZE_VERSION } from "@/lib/normalize";
import { canonicalise, JudgeError, type Judge } from "@/server/judge/core";
import { PROMPT_VERSION } from "@/server/judge/prompt";
import { env } from "@/server/env";

// AD-14. Items are sorted (code-unit order) and distinct, one assignment per item.
const rulingSchema = z
  .strictObject({
    kind: z.literal("partition"),
    promptVersion: z.string(),
    normalizeVersion: z.number().int(),
    model: z.string(),
    question: z.string(),
    items: z.array(z.string()),
    assignments: z.array(z.number().int()),
  })
  .refine(
    (r) => r.items.every((item, i) => i === 0 || r.items[i - 1] < item),
    "items must be sorted and distinct",
  )
  .refine(
    (r) =>
      r.normalizeVersion !== NORMALIZE_VERSION ||
      r.items.every((item) => normalize(item) === item),
    "items must be normalised",
  )
  .refine(
    (r) => r.assignments.length === r.items.length,
    "assignments must have one entry per item",
  );

type Ruling = z.infer<typeof rulingSchema>;

async function loadRulings(dir: string): Promise<Ruling[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files = names.filter((name) => name.endsWith(".json")).sort();
  const parsed = await Promise.all(
    files.map(async (name) => {
      const path = join(dir, name);
      try {
        return z
          .array(rulingSchema)
          .parse(JSON.parse(await readFile(path, "utf8")));
      } catch (cause) {
        // A plain Error, not a JudgeError: a broken file is a broken deployment.
        throw new Error(`Invalid ruling file: ${path}`, { cause });
      }
    }),
  );
  return parsed.flat();
}

export function createReplayJudge({
  dir = join(process.cwd(), "data/rulings"),
  hasKey = Boolean(env.OPENROUTER_API_KEY),
}: { dir?: string; hasKey?: boolean } = {}): Judge {
  let rulings: Promise<Ruling[]> | undefined;
  return {
    info: {
      provider: "replay",
      model: "replay",
      promptVersion: PROMPT_VERSION,
    },
    async partition({ question, items }) {
      const key = normalize(question);
      // A ruling from another normalisation rule may hold items this rule never produces.
      const matching = (await (rulings ??= loadRulings(dir))).filter(
        (r) =>
          r.normalizeVersion === NORMALIZE_VERSION &&
          normalize(r.question) === key,
      );
      // Cluster identity is (ruling, stored cluster): two rulings never merge clusters.
      const clusterOf = new Map<string, string>();
      matching.forEach((ruling, r) => {
        const stored = canonicalise(ruling.assignments, ruling.items.length);
        ruling.items.forEach((item, i) => {
          if (!clusterOf.has(item)) clusterOf.set(item, `${r}:${stored[i]}`);
        });
      });
      const ids = new Map<string, number>();
      const covered = items.map((item) => {
        const cluster = clusterOf.get(item);
        if (cluster === undefined) return undefined;
        if (!ids.has(cluster)) ids.set(cluster, ids.size);
        return ids.get(cluster);
      });
      if (ids.size === 0)
        throw new JudgeError(hasKey ? "NO_STORED_RULING" : "NO_KEY");
      // Uncovered items are singletons numbered after every covered cluster.
      let next = ids.size;
      return {
        assignments: covered.map((id) => id ?? next++),
        calls: 0,
        uncovered: next - ids.size,
        source: "stored",
      };
    },
  };
}
