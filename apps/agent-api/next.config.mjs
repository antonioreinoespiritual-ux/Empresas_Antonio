/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/core"],
  // apps/agent-api es una API pura consumida por agentes automatizados
  // (Claude/MCP), nunca por un navegador — no expone páginas ni UI de
  // React. Única excepción (F7, PLAN-AGENT-API-01): /openapi.json (route
  // handler, no una página) y public/docs.html (HTML estático servido tal
  // cual) — ninguno es UI de la app, son el contrato público de la API y
  // un visor de ese contrato para quien lo integre.
  poweredByHeader: false,
};

export default nextConfig;
