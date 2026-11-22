import { HostChrome } from "@/components/HostChrome";
import * as auth from "@/server/auth";

export default async function NotFound() {
  return (
    <HostChrome signedIn={await auth.hasSessionCookie()}>
      <h1 className="text-display">Siden finnes ikke.</h1>
    </HostChrome>
  );
}
