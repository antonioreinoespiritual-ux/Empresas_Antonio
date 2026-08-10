/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/core"],
  // apps/agent-api es una API pura consumida por agentes automatizados
  // (Claude/MCP), nunca por un navegador — no expone páginas ni UI.
  poweredByHeader: false,
};

export default nextConfig;
