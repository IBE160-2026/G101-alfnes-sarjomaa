"use server";

import { redirect } from "next/navigation";

// shortcut: deletes no session because none exist yet, Story 1.3 adds auth logout here
export async function logOut() {
  redirect("/");
}
