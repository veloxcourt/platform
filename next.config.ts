import type { NextConfig } from "next";

/// Orígenes extra permitidos en desarrollo (túnel HTTPS, celular en LAN, etc.).
/// Next.js bloquea por defecto el runtime cliente si el host no coincide con localhost.
const extraDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  /// Hostnames sin puerto (docs de Next). LAN + túnel Cloudflare.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "192.168.1.100",
    "192.168.18.62",
    ...extraDevOrigins,
  ],
};

export default nextConfig;
