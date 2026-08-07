import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "../prisma/client";
import { mailer } from "../email/mailer-instance";

// ADR-009: instancia de Better Auth exclusiva para AdminUser — separada de la de
// User en tablas, cookie y secreto, para eliminar la clase de vulnerabilidad de
// mass-assignment/IDOR de rol descrita en el threat model.
export const adminAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // fields mapea los nombres que Better Auth usa internamente (userId,
  // password) a las columnas reales de nuestro esquema (adminId,
  // passwordHash) — sin esto, Prisma rechaza o ignora sus escrituras.
  user: { modelName: "AdminUser" },
  session: { modelName: "AdminSession", fields: { userId: "adminId" } },
  account: { modelName: "AdminAccount", fields: { userId: "adminId", password: "passwordHash" } },
  verification: { modelName: "AdminVerification" },
  advanced: { cookiePrefix: "admin_auth" },
  secret: process.env.ADMIN_AUTH_SECRET,
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
    // El dashboard solo exige una sesión de AdminUser, no un AdminRole
    // asignado — con sign-up abierto, cualquiera que llame
    // /api/auth/sign-up/email obtendría acceso completo. Los administradores
    // se provisionan con el script scripts/seed-admin.mjs, nunca por registro
    // público.
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      await mailer.send({ to: user.email, template: "password-reset", data: { url } });
    },
  },
});
