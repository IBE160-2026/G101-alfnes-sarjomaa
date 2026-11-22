import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// FR-11, AD-7: no Token, edit secret or Answer a browser sent or received, nor its sha256,
// may appear in either server's output. A missing or empty log means the capture itself is broken.
export default function serverOutputTeardown() {
  const dir = process.env.E2E_OUT_DIR!;
  const secretsFile = path.join(dir, "secrets.jsonl");
  const values: string[] = existsSync(secretsFile)
    ? readFileSync(secretsFile, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string)
    : [];
  const needles = values.flatMap((value) => [
    { label: `${value.slice(0, 6)}…`, needle: value },
    {
      label: `sha256 of ${value.slice(0, 6)}…`,
      needle: createHash("sha256").update(value).digest("hex"),
    },
  ]);
  const leaks: string[] = [];
  for (const name of ["start.log", "dev.log"]) {
    const file = path.join(dir, name);
    process.stdout.write(`Server output: ${file}\n`);
    const log = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (!log) throw new Error(`${name} is missing or empty: ${file}`);
    for (const { label, needle } of needles) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      if (
        new RegExp(
          `(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`,
          "u",
        ).test(log)
      )
        leaks.push(`${name}: ${label}`);
    }
  }
  process.stdout.write(
    `Scanned for ${values.length} values from ${secretsFile}\n`,
  );
  if (leaks.length > 0)
    throw new Error(
      `Server output holds a Token, edit secret or Answer:\n${leaks.join("\n")}`,
    );
}
