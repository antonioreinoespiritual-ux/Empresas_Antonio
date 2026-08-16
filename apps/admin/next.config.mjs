// Editor de landings v2, Fase 5 (§7) — mismo motivo que apps/web/next.config.mjs.
const remotePatterns = process.env.MEDIA_PUBLIC_HOST ? [{ protocol: "https", hostname: process.env.MEDIA_PUBLIC_HOST }] : [];

const isDev = process.env.NODE_ENV !== "production";

// Fase 8 (§1.6 punto 4, hardening) — CSP básica. apps/admin no tiene
// checkout ni VSL (eso vive solo en apps/web) — sin Wompi, sin frame-src
// más allá de 'self'. img-src amplio por el mismo motivo que apps/web: la
// biblioteca de Assets (Fase 5) sirve miniaturas desde MEDIA_PUBLIC_HOST.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws://localhost:*" : ""}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/core", "@repo/admin-ui"],
  images: { remotePatterns },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
