"use client";

import { HostChrome } from "@/components/HostChrome";
import { ServerError } from "@/components/ServerError";

// Outside /spill a client component cannot know the session, so the chrome is signed out;
// errors inside /spill are caught by spill/error.tsx under the signed-in layout.
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <HostChrome signedIn={false}>
      <ServerError retry={retry} />
    </HostChrome>
  );
}
