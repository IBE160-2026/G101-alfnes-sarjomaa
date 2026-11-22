"use server";

import { redirect } from "next/navigation";
import { registerForm } from "@/app/registrer/schema";
import { toFailure, validate, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";

export async function register(
  _prev: unknown,
  formData: FormData,
): Promise<Failure> {
  try {
    await auth.register(validate(registerForm, Object.fromEntries(formData)));
  } catch (error) {
    return toFailure(error);
  }
  redirect("/spill");
}
