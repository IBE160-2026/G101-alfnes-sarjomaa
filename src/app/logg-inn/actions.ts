"use server";

import { redirect } from "next/navigation";
import { toFailure, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";

export async function logIn(
  _prev: unknown,
  formData: FormData,
): Promise<Failure> {
  try {
    await auth.logIn(Object.fromEntries(formData)); // validated there
  } catch (error) {
    return toFailure(error);
  }
  redirect("/spill");
}
