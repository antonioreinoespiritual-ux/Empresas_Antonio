import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../prisma/client";

// ADR-009: instancia de Better Auth exclusiva para User — tablas, cookie y secreto
// propios, sin relación con AdminUser. Verificar nombres exactos de estas opciones
// contra la versión de better-auth instalada.
export const userAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: { modelName: "User" },
  session: { modelName: "UserSession" },
  account: { modelName: "UserAccount" },
  verification: { modelName: "UserVerification" },
  advanced: { cookiePrefix: "user_auth" },
  secret: process.env.USER_AUTH_SECRET,
  emailAndPassword: { enabled: true },
});
