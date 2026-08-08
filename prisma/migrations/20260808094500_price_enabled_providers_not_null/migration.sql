-- Cierra el hueco P2 detectado en revisión: la migración anterior dejó la
-- columna nullable pese a que el schema la declara como lista requerida.
-- Cualquier escritor fuera de Prisma (SQL directo, import) podría dejar
-- NULL en la columna, lo que rompe `stored.length` en el mapeo de dominio
-- (toDomainEnabledProviders). Se respalda cualquier NULL existente con el
-- default antes de aplicar la restricción.
UPDATE "prices" SET "enabledProviders" = ARRAY[]::"PaymentProviderType"[] WHERE "enabledProviders" IS NULL;

ALTER TABLE "prices" ALTER COLUMN "enabledProviders" SET NOT NULL;
