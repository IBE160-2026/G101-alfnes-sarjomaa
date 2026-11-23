import { LinkStatus } from "@/components/LinkStatus";
import { ParticipantChrome } from "@/components/ParticipantChrome";

// The same page as a client-side LINK_UNKNOWN (FR-3, FR-9).
export default function InviteLinkNotFound() {
  return (
    <ParticipantChrome>
      <LinkStatus status="unknown" />
    </ParticipantChrome>
  );
}
