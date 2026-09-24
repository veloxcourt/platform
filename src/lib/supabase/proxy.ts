import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  PASSWORD_RESET_COOKIE,
  passwordResetCookieOptions,
} from "@/lib/auth/password-reset-cookie";

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  };
};

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.includes("-auth-token") &&
        !cookie.name.includes("code-verifier") &&
        Boolean(cookie.value),
    );
}

export async function updateSupabaseSession(request: NextRequest) {
  const pendingCookies: CookieToSet[] = [];

  const applyCookies = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  };

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => {
            pendingCookies.push(cookie as CookieToSet);
            request.cookies.set(cookie.name, cookie.value);
          });
          response = applyCookies(NextResponse.next({ request }));
        },
      },
    },
  );

  // Fuerza la validación/refrescado del token antes de renderizar.
  await supabase.auth.getClaims();

  const pendingReset =
    request.cookies.get(PASSWORD_RESET_COOKIE)?.value === "1";
  if (!pendingReset) return applyCookies(response);

  if (!hasSupabaseSessionCookie(request)) {
    const cleared = applyCookies(response);
    cleared.cookies.set(PASSWORD_RESET_COOKIE, "", {
      ...passwordResetCookieOptions,
      maxAge: 0,
    });
    return cleared;
  }

  const path = request.nextUrl.pathname;
  const allowed = path === "/set-password" || path.startsWith("/auth/");
  if (allowed) return applyCookies(response);

  const url = request.nextUrl.clone();
  url.pathname = "/set-password";
  url.search = "?from=recovery";
  return applyCookies(NextResponse.redirect(url));
}
