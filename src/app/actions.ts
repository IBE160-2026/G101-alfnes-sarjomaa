"use server";

import { redirect } from "next/navigation";
import * as auth from "@/server/auth";

export async function logOut() {
  await auth.logOut();
  redirect("/");
}
