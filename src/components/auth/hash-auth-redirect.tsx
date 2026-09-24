"use client";

import { useEffect } from "react";

/**
 * Si Supabase deja los tokens en la home (`/#access_token=...`),
 * los lleva a la pantalla que pide la contraseña nueva.
 */
export function HashAuthRedirect() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    if (!params.get("access_token") && !params.get("error")) return;

    const path = window.location.pathname;
    if (
      path.startsWith("/auth/confirm") ||
      path.startsWith("/auth/callback") ||
      path.startsWith("/set-password")
    ) {
      return;
    }

    const from = params.get("type") === "recovery" ? "?from=recovery" : "";
    window.location.replace(`/auth/confirm${from}${window.location.hash}`);
  }, []);

  return null;
}
