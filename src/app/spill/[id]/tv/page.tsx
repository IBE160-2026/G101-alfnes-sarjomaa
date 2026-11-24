import { playMetadata, playPage } from "@/app/spill/[id]/play-page";

export function generateMetadata({ params }: PageProps<"/spill/[id]/tv">) {
  return playMetadata(params);
}

// FR-24 to FR-27: the TV page, the room's Board without controls; the Host plays from /vert.
export default function TvPage({ params }: PageProps<"/spill/[id]/tv">) {
  return playPage(params, "tv");
}
