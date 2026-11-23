import net from "node:net";
import { afterAll, beforeEach, vi } from "vitest";
import { closeDb } from "@/server/db/client";
import { afterTasks } from "./integration/next-mocks";

// The real after() throws outside a request scope; here it queues the task, and a test
// runs the queue with runAfterTasks(). connection() throws there too, so it resolves.
vi.mock("next/server", async (importOriginal) => {
  const { afterTasks } = await import("./integration/next-mocks");
  return {
    ...(await importOriginal<typeof import("next/server")>()),
    after: (task: () => unknown) => {
      afterTasks.push(task);
    },
    connection: async () => undefined,
  };
});
beforeEach(() => {
  afterTasks.length = 0;
});

// NFR-3: tests never touch the network. Any socket to a host other than
// localhost fails before DNS is even asked.
const isLocal = (host: unknown) =>
  host === undefined ||
  host === "localhost" ||
  host === "::1" ||
  (typeof host === "string" && host.startsWith("127."));

function targetHost(args: unknown[]): { local: boolean; host?: unknown } {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  // A numeric string is a port, as in Node; any other string is an IPC path.
  if (typeof first === "string" && !/^\d+$/.test(first)) return { local: true };
  if (typeof first === "number" || typeof first === "string")
    return { local: isLocal(args[1]), host: args[1] };
  const options = (first ?? {}) as { host?: unknown; path?: unknown };
  if (options.path !== undefined) return { local: true };
  return { local: isLocal(options.host), host: options.host };
}

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
  const { local, host } = targetHost(args);
  if (!local) throw new Error(`network blocked in tests: ${String(host)}`);
  return (connect as (...a: unknown[]) => net.Socket).apply(this, args);
} as typeof connect;

// Each test file gets its own in-memory database.
afterAll(closeDb);
