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
  user: { modelName: "AdminUser" },
  session: { modelName: "AdminSession" },
  account: { modelName: "AdminAccount" },
  verification: { modelName: "AdminVerification" },
  advanced: { cookiePrefix: "admin_auth" },
  secret: process.env.ADMIN_AUTH_SECRET,
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await mailer.send({ to: user.email, template: "password-reset", data: { url } });
    },
  },
});
