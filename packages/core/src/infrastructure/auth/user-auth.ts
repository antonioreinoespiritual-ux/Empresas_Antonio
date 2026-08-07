import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "../prisma/client";
import { mailer } from "../email/mailer-instance";

// ADR-009: instancia de Better Auth exclusiva para User — tablas, cookie y secreto
// propios, sin relación con AdminUser.
export const userAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: { modelName: "User" },
  session: { modelName: "UserSession" },
  // password mapea el nombre interno de Better Auth a nuestra columna
  // passwordHash — sin esto, Prisma rechaza la escritura de la credencial.
  account: { modelName: "UserAccount", fields: { password: "passwordHash" } },
  verification: { modelName: "UserVerification" },
  advanced: { cookiePrefix: "user_auth" },
  secret: process.env.USER_AUTH_SECRET,
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await mailer.send({ to: user.email, template: "password-reset", data: { url } });
    },
  },
});
