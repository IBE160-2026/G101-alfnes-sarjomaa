"use server";

import { redirect } from "next/navigation";
import { loginForm } from "@/app/logg-inn/schema";
import { toFailure, validate, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";

export async function logIn(
  _prev: unknown,
  formData: FormData,
): Promise<Failure> {
  try {
    await auth.logIn(validate(loginForm, Object.fromEntries(formData)));
  } catch (error) {
    return toFailure(error);
  }
  redirect("/spill");
}
