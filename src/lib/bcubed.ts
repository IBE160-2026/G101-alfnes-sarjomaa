// Weighted B-cubed (FR-32, SM-2). Each item stands for `weight` identical answers. An answer's
// precision is the share of its Group that lies in its gold cluster, its recall the share of its
// gold cluster that lies in its Group; both are averaged over all answers. Keys are compared as
// given, so a caller scoring several Questions scopes them per Question.
export function bcubed(
  items: { weight: number; gold: string; group: string }[],
): { precision: number; recall: number; f1: number } {
  const totals = new Map<string, number>();
  const add = (key: string, weight: number) =>
    totals.set(key, (totals.get(key) ?? 0) + weight);
  const keys = ({ gold, group }: { gold: string; group: string }) => ({
    gold: JSON.stringify(["gold", gold]),
    group: JSON.stringify(["group", group]),
    both: JSON.stringify(["both", gold, group]),
  });
  let total = 0;
  for (const item of items) {
    if (!(item.weight > 0)) throw new Error("Every weight must be positive.");
    const k = keys(item);
    add(k.gold, item.weight);
    add(k.group, item.weight);
    add(k.both, item.weight);
    total += item.weight;
  }
  if (total === 0) throw new Error("B-cubed needs at least one item.");
  let precision = 0;
  let recall = 0;
  for (const item of items) {
    const k = keys(item);
    const both = totals.get(k.both)!;
    precision += (item.weight * both) / totals.get(k.group)!;
    recall += (item.weight * both) / totals.get(k.gold)!;
  }
  precision /= total;
  recall /= total;
  return {
    precision,
    recall,
    f1: (2 * precision * recall) / (precision + recall),
  };
}
