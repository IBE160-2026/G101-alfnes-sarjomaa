import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOARD_SIZE, LABEL_MAX, QUESTION_TEXT_MAX } from "@/lib/limits";
import { createFromSetSchema, QUESTION_SETS } from "@/lib/question-sets";
import { boardCut, rankGroups } from "@/lib/ranking";

type Row = {
  metadata: { id: string };
  answers: { clusters: Record<string, { count: number }> };
};

const rows = new Map(
  readFileSync("data/protoqa/dev.crowdsourced.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Row)
    .map((row) => [row.metadata.id, row.answers.clusters]),
);

const questions = QUESTION_SETS.flatMap((set) => set.questions);

describe("the ProtoQA Question sets", () => {
  it("FR-33: five sets of five Questions, every id and source Question used once", () => {
    expect(QUESTION_SETS).toHaveLength(5);
    for (const set of QUESTION_SETS) expect(set.questions).toHaveLength(5);
    expect(new Set(QUESTION_SETS.map((s) => s.id)).size).toBe(5);
    expect(new Set(questions.map((q) => q.sourceId)).size).toBe(25);
  });

  it("FR-33 (AC2): each Board is the source's top clusters by count, at most eight, with every Count unchanged and no tie at the cut", () => {
    for (const q of questions) {
      const clusters = rows.get(q.sourceId);
      expect(clusters, q.sourceId).toBeDefined();
      const byCount = Object.entries(clusters!)
        .map(([id, c]) => ({ id, count: c.count }))
        .sort((a, b) => b.count - a.count);
      const n = Math.min(BOARD_SIZE, byCount.length);
      expect(q.groups, q.sourceId).toHaveLength(n);
      for (const g of q.groups)
        expect(g.count, g.cluster).toBe(clusters![g.cluster]?.count);
      expect(new Set(q.groups.map((g) => g.cluster)), q.sourceId).toEqual(
        new Set(byCount.slice(0, n).map((c) => c.id)),
      );
      if (byCount.length > n)
        expect(byCount[n - 1].count, q.sourceId).toBeGreaterThan(
          byCount[n].count,
        );
    }
  });

  it("FR-33, NFR-7: every Question text and label is trimmed and within the app's limits, and no label repeats on a Board", () => {
    for (const q of questions) {
      expect(q.text).toBe(q.text.trim());
      expect(q.text.length).toBeGreaterThan(0);
      expect(q.text.length).toBeLessThanOrEqual(QUESTION_TEXT_MAX);
      for (const { label } of q.groups) {
        expect(label).toBe(label.trim());
        expect(label.length).toBeGreaterThan(0);
        expect(label.length, label).toBeLessThanOrEqual(LABEL_MAX);
      }
      expect(new Set(q.groups.map((g) => g.label)).size).toBe(q.groups.length);
    }
  });

  it("FR-33 (AC2), AD-11: rankGroups and boardCut keep every Group of a set Question", () => {
    for (const q of questions) {
      const { board } = boardCut(
        rankGroups(
          q.groups.map((g) => ({
            groupId: g.cluster,
            count: g.count,
            rank1Count: 0,
            labelCandidates: [],
            customLabel: g.label,
            discarded: false,
          })),
        ),
      );
      expect(board.map((g) => g.label)).toHaveLength(q.groups.length);
    }
  });

  it("FR-33: createFromSetSchema takes a listed set and refuses any other id", () => {
    expect(
      createFromSetSchema.safeParse({ title: "Fredag", questionSet: "hjemme" })
        .success,
    ).toBe(true);
    const result = createFromSetSchema.safeParse({
      title: "Fredag",
      questionSet: "finnes-ikke",
    });
    expect(result.error?.issues[0].message).toBe("Velg et sett fra lista.");
  });
});
