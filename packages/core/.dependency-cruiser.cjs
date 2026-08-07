/**
 * Hace cumplir en CI los límites de módulo del monolito modular (ADR-010):
 * domain no importa nada externo; application no importa infrastructure
 * directamente (solo a través de sus propios ports).
 */
module.exports = {
  forbidden: [
    {
      name: "domain-no-application",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/application" },
    },
    {
      name: "domain-no-infrastructure",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "domain-no-external-deps",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: "node_modules/(prisma|@prisma|better-auth|resend|next)",
      },
    },
    {
      name: "application-no-infrastructure",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/infrastructure" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
