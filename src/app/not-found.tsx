import type { Metadata } from "next";
import Link from "next/link";
import { HostChrome } from "@/components/HostChrome";
import * as auth from "@/server/auth";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Siden finnes ikke" };

export default async function NotFound() {
  const signedIn = await auth.hasSessionCookie();
  return (
    <HostChrome signedIn={signedIn} demo={env.DEMO_MODE}>
      <h1 className="text-display">Siden finnes ikke.</h1>
      <p className="mt-6">
        <Link
          href={signedIn ? "/spill" : "/"}
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          {signedIn ? "Mine spill" : "Til forsiden"}
        </Link>
      </p>
    </HostChrome>
  );
}
