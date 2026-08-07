import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { adminAuth } from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";

// Regresión de un hallazgo P1 real de revisión: sin `fields` mapping,
// Better Auth intenta leer/escribir `userId`/`password` que no existen en
// AdminSession/AdminAccount (nuestras columnas son `adminId`/`passwordHash`)
// y el login de administradores queda roto en producción sin que ningún
// typecheck/build lo detecte — solo se ve al ejecutar el flujo real.
describe("adminAuth: mapeo de campos (adminId/passwordHash) y sign-up deshabilitado", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sign-up público está deshabilitado (no se puede crear un AdminUser por la API)", async () => {
    await expect(
      adminAuth.api.signUpEmail({
        body: { email: `attacker-${randomUUID()}@example.com`, password: "SuperSecret123", name: "Attacker" },
      })
    ).rejects.toThrow();
  });

  it("un AdminUser sembrado directamente (como scripts/seed-admin.mjs) puede iniciar sesión real", async () => {
    const email = `admin-${randomUUID()}@example.com`;
    const password = "SuperSecret123";
    const passwordHash = await hashPassword(password);

    // accountId = el propio id del AdminUser, igual que hace Better Auth en
    // signUpEmail — nunca el email.
    const admin = await prisma.adminUser.create({ data: { email, name: "Admin de prueba" } });
    await prisma.adminAccount.create({
      data: { adminId: admin.id, providerId: "credential", accountId: admin.id, passwordHash },
    });

    const result = await adminAuth.api.signInEmail({ body: { email, password } });
    expect(result.user.id).toBe(admin.id);
    expect(result.token).toBeTruthy();

    // Prueba directa de que la sesión quedó en la columna real `adminId`,
    // no en una columna `userId` inexistente.
    const session = await prisma.adminSession.findUnique({ where: { token: result.token } });
    expect(session?.adminId).toBe(admin.id);
  });

  it("rechaza una contraseña incorrecta para un AdminUser real", async () => {
    const email = `admin-${randomUUID()}@example.com`;
    const passwordHash = await hashPassword("SuperSecret123");
    const admin = await prisma.adminUser.create({ data: { email, name: "Admin de prueba" } });
    await prisma.adminAccount.create({
      data: { adminId: admin.id, providerId: "credential", accountId: admin.id, passwordHash },
    });

    await expect(adminAuth.api.signInEmail({ body: { email, password: "wrong-password" } })).rejects.toThrow();
  });
});
