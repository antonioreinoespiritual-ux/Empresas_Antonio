import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { userAuth } from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";

// Regresión de un hallazgo P1 real de revisión: sin `fields: { password:
// "passwordHash" }`, Better Auth intenta leer/escribir una columna `password`
// que no existe en UserAccount (la nuestra es `passwordHash`) y el registro
// real desde /registro queda roto — solo se ve ejecutando el flujo real, no
// con typecheck/build.
describe("userAuth: registro real -> login real (fields.password -> passwordHash)", () => {
  it("signUpEmail crea User+UserAccount reales y el password persiste en passwordHash", async () => {
    const email = `buyer-${randomUUID()}@example.com`;
    const password = "SuperSecret123";

    const signUpResult = await userAuth.api.signUpEmail({ body: { email, password, name: "Compradora de prueba" } });
    expect(signUpResult.user.email).toBe(email);

    const account = await prisma.userAccount.findFirst({
      where: { userId: signUpResult.user.id, providerId: "credential" },
    });
    expect(account?.passwordHash).toBeTruthy();

    const signInResult = await userAuth.api.signInEmail({ body: { email, password } });
    expect(signInResult.user.id).toBe(signUpResult.user.id);
  });
});
