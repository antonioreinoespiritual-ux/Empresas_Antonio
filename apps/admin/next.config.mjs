// Editor de landings v2, Fase 5 (§7) — mismo motivo que apps/web/next.config.mjs.
const remotePatterns = process.env.MEDIA_PUBLIC_HOST ? [{ protocol: "https", hostname: process.env.MEDIA_PUBLIC_HOST }] : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/core", "@repo/admin-ui"],
  images: { remotePatterns },
};

export default nextConfig;
