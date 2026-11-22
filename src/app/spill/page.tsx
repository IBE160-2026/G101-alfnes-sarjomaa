import { HostChrome } from "@/components/HostChrome";
import * as auth from "@/server/auth";

export default async function GamesPage() {
  await auth.requireHost();
  return (
    <HostChrome signedIn>
      <h1 className="text-display">Mine spill</h1>
    </HostChrome>
  );
}
