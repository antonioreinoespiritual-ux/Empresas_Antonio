// Editor de landings v2, Fase 5 (ARCH-LANDING-EDITOR-02 §7) — Assets reales
// sirven desde el bucket público de Supabase Storage, no desde este mismo
// host. next/image exige allow-listar el host remoto explícitamente; sin
// MEDIA_PUBLIC_HOST configurada (p. ej. en dev local antes de que Antonio
// provisione el bucket) queda sin hosts remotos permitidos — un Asset real
// simplemente no podría optimizarse hasta que se configure, en vez de
// fallar en build.
const remotePatterns = process.env.MEDIA_PUBLIC_HOST ? [{ protocol: "https", hostname: process.env.MEDIA_PUBLIC_HOST }] : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/core", "@repo/ui"],
  images: { remotePatterns },
};

export default nextConfig;
