import type { ReactNode } from "react";
import { HostChrome } from "@/components/HostChrome";
import * as auth from "@/server/auth";

// Outside loading.tsx's Suspense boundary, so a logged-out hard load gets a real
// redirect before streaming starts. Pages still call requireHost themselves (AD-5).
export default async function SpillLayout({
  children,
}: {
  children: ReactNode;
}) {
  await auth.requireHost();
  return <HostChrome signedIn>{children}</HostChrome>;
}
