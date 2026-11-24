import { playMetadata, playPage } from "@/app/spill/[id]/play-page";

export function generateMetadata({ params }: PageProps<"/spill/[id]/skjerm">) {
  return playMetadata(params, "skjerm");
}

// FR-23 to FR-27: the one shared screen, controls included.
export default function ScreenPage({
  params,
}: PageProps<"/spill/[id]/skjerm">) {
  return playPage(params, "skjerm");
}
