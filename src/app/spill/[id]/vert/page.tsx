import { playMetadata, playPage } from "@/app/spill/[id]/play-page";

export function generateMetadata({ params }: PageProps<"/spill/[id]/vert">) {
  return playMetadata(params);
}

// FR-24 to FR-27: the Host view, the answer key and the controls beside the TV page.
export default function HostViewPage({
  params,
}: PageProps<"/spill/[id]/vert">) {
  return playPage(params, "vert");
}
