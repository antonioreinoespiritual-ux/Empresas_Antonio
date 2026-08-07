// Crea el primer AdminUser directamente en la base de datos. Necesario
// porque el sign-up público de la instancia admin de Better Auth está
// deshabilitado a propósito (ver admin-auth.ts) — cualquier registro abierto
// en el panel de administración sería una vulnerabilidad crítica. Usa el
// mismo esquema de hash que Better Auth (`better-auth/crypto`) para que el
// admin pueda iniciar sesión normalmente por /login.
//
// Uso: node --env-file=.env packages/core/scripts/seed-admin.mjs \
//        --email admin@empresa.com --password "una-contraseña-fuerte" --name "Nombre"
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, "");
    const value = process.argv[i + 1];
    if (key && value) args[key] = value;
  }
  return args;
}

async function main() {
  const { email, password, name } = parseArgs();
  if (!email || !password || !name) {
    console.error('Uso: node --env-file=.env packages/core/scripts/seed-admin.mjs --email <email> --password <password> --name "<nombre>"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      console.error(`Ya existe un AdminUser con email ${email}.`);
      process.exit(1);
    }

    const passwordHash = await hashPassword(password);
    // accountId = el id del propio AdminUser, igual que hace Better Auth en
    // signUpEmail (ver better-auth/dist/api/routes/sign-up.mjs) — nunca el
    // email.
    const admin = await prisma.adminUser.create({ data: { email, name, isActive: true } });
    await prisma.adminAccount.create({
      data: { adminId: admin.id, providerId: "credential", accountId: admin.id, passwordHash },
    });

    console.log(`AdminUser creado: ${admin.id} (${admin.email}). Ya puede iniciar sesión en /login.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
