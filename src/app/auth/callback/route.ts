import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { linkAuthUserToLocalAccount } from "@/lib/auth/complete-email-link";
import {
  PASSWORD_RESET_COOKIE,
  passwordResetCookieOptions,
} from "@/lib/auth/password-reset-cookie";

export const runtime = "nodejs";

function requestOrigin(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "") ??
    "http";
  const safeHost = host.replace(/^0\.0\.0\.0/, "localhost");
  return `${proto}://${safeHost}`;
}

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

function confirmErrorPath(isRecovery: boolean, error: string) {
  const params = new URLSearchParams({ error });
  if (isRecovery) params.set("from", "recovery");
  return `/auth/confirm?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const isRecovery = from === "recovery" || type === "recovery";

  const pendingCookies: CookieToSet[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) =>
            pendingCookies.push(cookie as CookieToSet),
          );
        },
      },
    },
  );

  const finish = (path: string, extra?: CookieToSet[]) => {
    const response = NextResponse.redirect(new URL(path, origin));
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    extra?.forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    });
    return response;
  };

  let exchangeFailed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) exchangeFailed = true;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) exchangeFailed = true;
  } else {
    return finish(confirmErrorPath(isRecovery, "invalid"));
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (exchangeFailed && !authUser) {
    return finish(confirmErrorPath(isRecovery, "invalid"));
  }
  if (!authUser?.email) {
    return finish(confirmErrorPath(isRecovery, "invalid"));
  }

  const linked = await linkAuthUserToLocalAccount(
    { id: authUser.id, email: authUser.email },
    { activateInvites: !isRecovery },
  );
  if (!linked.ok) {
    if (linked.signOut) await supabase.auth.signOut();
    return finish(
      confirmErrorPath(
        isRecovery,
        linked.error.includes("club") ? "no-club" : "mismatch",
      ),
    );
  }

  return finish(isRecovery ? "/set-password?from=recovery" : "/set-password", [
    {
      name: PASSWORD_RESET_COOKIE,
      value: "1",
      options: passwordResetCookieOptions,
    },
  ]);
}
