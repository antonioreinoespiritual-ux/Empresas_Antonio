// Editor de landings v2, Fase 5 (ARCH-LANDING-EDITOR-02 §7) — Assets reales
// sirven desde el bucket público de Supabase Storage, no desde este mismo
// host. next/image exige allow-listar el host remoto explícitamente; sin
// MEDIA_PUBLIC_HOST configurada (p. ej. en dev local antes de que Antonio
// provisione el bucket) queda sin hosts remotos permitidos — un Asset real
// simplemente no podría optimizarse hasta que se configure, en vez de
// fallar en build.
const remotePatterns = process.env.MEDIA_PUBLIC_HOST ? [{ protocol: "https", hostname: process.env.MEDIA_PUBLIC_HOST }] : [];

const isDev = process.env.NODE_ENV !== "production";

// Fase 8 (§1.6 punto 4, hardening) — CSP básica. Los dos orígenes externos
// reales que apps/web carga en el navegador:
// - checkout.wompi.co: script del widget (apps/web/src/lib/wompi-widget.ts)
//   que abre su propio <iframe> de checkout.wompi.co y hace llamadas a
//   *.wompi.co — nunca verificado contra un checkout real con credenciales
//   de producción (WOMPI_PUBLIC_KEY vacía en este entorno), calibrado por
//   documentación pública de Wompi.
// - PayPal NO necesita frame-src/connect-src: el flujo es un redirect de
//   página completa a approveUrl (checkout-form.tsx), nunca un iframe/XHR
//   embebido — confirmado leyendo el código, no documentación.
// frame-src/img-src usan `https:` amplio a propósito: el VSL/thank-you
// video es una URL que el admin tipea libre (cualquier proveedor de
// embeds), y las imágenes de Composition vienen de MEDIA_PUBLIC_HOST
// (dinámico, Supabase Storage) — restringir a una allow-list fija de
// proveedores rompería el primer VSL de un proveedor no anticipado.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.wompi.co`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.wompi.co${isDev ? " ws://localhost:*" : ""}`,
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/core", "@repo/ui"],
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
