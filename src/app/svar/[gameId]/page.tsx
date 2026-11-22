import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteLinkView } from "@/components/InviteLinkView";
import { LinkStatus } from "@/components/LinkStatus";
import { ParticipantChrome } from "@/components/ParticipantChrome";
import * as collection from "@/server/collection";

// No title (the root default "Toppsvar") and no Open Graph, so a link preview shows nothing.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Generic on purpose: the server knows only the gameId, never the Token, and renders
// no Game title or Question; the client loads those through openInviteLink.
export default async function InviteLinkPage({
  params,
}: PageProps<"/svar/[gameId]">) {
  const { gameId } = await params;
  const status = await collection.linkStatus(gameId);
  if (status === "unknown") notFound();
  return (
    <ParticipantChrome>
      {status === "closed" ? (
        <LinkStatus status="closed" />
      ) : (
        <InviteLinkView gameId={gameId} />
      )}
    </ParticipantChrome>
  );
}
