-- F4 (escritura agentic, PLAN-AGENT-API-01) — habilita variantes A/B reales
-- de Page (variantGroupId/variantLabel existían desde F0, "preparado, sin
-- implementar"). El @@unique([offerId, kind]) original nunca permitía una
-- segunda Page para la misma Offer+kind, ni siquiera como variante.
--
-- Aditiva sobre datos existentes: hoy TODA fila de "pages" tiene
-- "variantLabel" NULL (nunca se usó), así que el índice único parcial de
-- abajo (WHERE "variantLabel" IS NULL) es, en este momento, exactamente
-- equivalente al índice que reemplaza — cero cambio de comportamiento para
-- filas existentes, solo habilita que una futura Page con variantLabel no
-- nulo coexista con su primaria.

-- DropIndex
DROP INDEX "pages_offerId_kind_key";

-- CreateIndex
-- Único constraint expresable declarativamente en Prisma — cierra el caso
-- de dos variantes reales (variantLabel no nulo) duplicadas para la misma
-- Offer+kind. NO alcanza para el caso NULL (SQL estándar: NULL != NULL),
-- por eso el índice parcial de abajo es necesario además de este.
CREATE UNIQUE INDEX "pages_offerId_kind_variantLabel_key" ON "pages"("offerId", "kind", "variantLabel");

-- CreateIndex
-- Índice único parcial — Prisma no puede expresar esto en @@unique. Cierra
-- el caso que el índice de arriba no cubre: exactamente una Page "primaria"
-- (variantLabel IS NULL) por (offerId, kind), igual que garantizaba el
-- constraint original antes de este cambio.
CREATE UNIQUE INDEX "pages_offerId_kind_primary_key" ON "pages"("offerId", "kind") WHERE "variantLabel" IS NULL;
