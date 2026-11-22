"use client";

import { ParticipantChrome } from "@/components/ParticipantChrome";
import { ServerError } from "@/components/ServerError";

export default function InviteLinkError({ retry }: { retry: () => void }) {
  return (
    <ParticipantChrome>
      <ServerError retry={retry} />
    </ParticipantChrome>
  );
}
