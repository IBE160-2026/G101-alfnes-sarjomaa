import { redirect } from "next/navigation";

// The one-screen stage is gone (Story 8.6); an old bookmark lands on the Game page, which
// owns not-found.
export default async function ScreenPage({
  params,
}: PageProps<"/spill/[id]/skjerm">) {
  redirect(`/spill/${encodeURIComponent((await params).id)}`);
}
