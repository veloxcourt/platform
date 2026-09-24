import "server-only";

import { cookies } from "next/headers";

import {
  PASSWORD_RESET_COOKIE,
  passwordResetCookieOptions,
} from "./password-reset-cookie";

export async function markPasswordResetRequired() {
  const store = await cookies();
  store.set(PASSWORD_RESET_COOKIE, "1", passwordResetCookieOptions);
}

export async function clearPasswordResetRequired() {
  const store = await cookies();
  store.set(PASSWORD_RESET_COOKIE, "", {
    ...passwordResetCookieOptions,
    maxAge: 0,
  });
}

export async function isPasswordResetRequired() {
  const store = await cookies();
  return store.get(PASSWORD_RESET_COOKIE)?.value === "1";
}
