import { headers } from "next/headers";

function normalizeOrigin(raw: string) {
  return raw
    .replace(/\/$/, "")
    .replace(/^https?:\/\/0\.0\.0\.0/i, (match) =>
      match.toLowerCase().startsWith("https")
        ? "https://localhost"
        : "http://localhost",
    );
}

/** Origen de la pestaña que disparó la acción (local vs producción). */
export async function appOrigin() {
  const requestHeaders = await headers();
  const headerOrigin = requestHeaders.get("origin");
  const referer = requestHeaders.get("referer");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const host = requestHeaders.get("host");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  let fromReferer: string | null = null;
  if (referer) {
    try {
      fromReferer = new URL(referer).origin;
    } catch {
      fromReferer = null;
    }
  }

  const fromForwarded = forwardedHost
    ? `${forwardedProto ?? "http"}://${forwardedHost}`
    : null;
  const fromHost = host ? `${forwardedProto ?? "http"}://${host}` : null;
  const requestOrigin = headerOrigin ?? fromReferer ?? fromForwarded ?? fromHost;

  if (requestOrigin) return normalizeOrigin(requestOrigin);
  if (siteUrl) return normalizeOrigin(siteUrl);
  return "http://localhost:3000";
}

export async function authConfirmUrl(from?: "recovery") {
  const base = `${await appOrigin()}/auth/confirm`;
  return from === "recovery" ? `${base}?from=recovery` : base;
}
