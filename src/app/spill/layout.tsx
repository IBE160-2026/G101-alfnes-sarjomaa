import { after } from "next/server";
import type { ReactNode } from "react";
import { HostChrome } from "@/components/HostChrome";
import * as auth from "@/server/auth";
import * as games from "@/server/games";

// Outside loading.tsx's Suspense boundary, so a logged-out hard load gets a real
// redirect before streaming starts. Pages still call requireHost themselves (AD-5).
export default async function SpillLayout({
  children,
}: {
  children: ReactNode;
}) {
  await auth.requireHost();
  // After the response, so a slow or failing purge never touches this request (AD-23).
  after(() => games.purgeIfDue());
  return <HostChrome signedIn>{children}</HostChrome>;
}
