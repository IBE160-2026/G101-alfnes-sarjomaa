import "server-only";

export type LogEntry = {
  module: string;
  op: string;
  code: string;
  sqlstate?: string;
};

const FIELDS = ["module", "op", "code", "sqlstate"] as const;

// Copies only the four allowed string fields, so a caller cannot leak a message,
// an argument or a request object into the log even by passing extra properties.
export function log(entry: LogEntry): void {
  const line: Partial<Record<(typeof FIELDS)[number], string>> = {};
  for (const field of FIELDS) {
    const value: unknown = entry[field];
    if (typeof value === "string") line[field] = value;
  }
  process.stderr.write(`${JSON.stringify(line)}\n`);
}
