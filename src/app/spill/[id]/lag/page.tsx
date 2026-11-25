import { playMetadata, playPage } from "@/app/spill/[id]/play-page";

export function generateMetadata({ params }: PageProps<"/spill/[id]/lag">) {
  return playMetadata(params, "lag");
}

// FR-23: Team setup on its own Host page; a Game that is not ready goes to the Game page.
export default function TeamPage({ params }: PageProps<"/spill/[id]/lag">) {
  return playPage(params, "lag");
}
