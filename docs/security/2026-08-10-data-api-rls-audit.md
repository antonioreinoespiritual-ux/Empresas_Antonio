# Informe de auditoría — Data API / RLS de Supabase

- **Fecha**: 2026-08-10
- **Alcance**: proyecto Supabase de producción de Empresas Antonio
  (apps/web, apps/admin, apps/agent-api, Better Auth, pagos)
- **Disparador**: verificación de si RLS estaba activo en las tablas de
  `public`.
- **Resultado**: exposición real confirmada y cerrada (Data API apagada +
  grants revocados); sin evidencia de explotación en la ventana auditable.
- **Decisión registrada en**: [ADR-015](../adr/ADR-015-data-api-rls-hardening.md)

## 1. Hallazgo inicial

- Data API (PostgREST) de Supabase: **habilitado**.
- RLS: **desactivado** en todas las tablas de `public`.
- Grants heredados de Supabase sobre tablas existentes: `ALL` para
  `anon` y `authenticated`.
- Prueba HTTP directa con la `anon key` pública, antes del fix:

  | Endpoint | Antes | Después |
  |---|---|---|
  | `/rest/v1/products` | `200` | `401`, luego `503 PGRST002` (Data API off) |
  | `/rest/v1/users` | `200` | `401` / `503` |
  | `/rest/v1/payments` | `201` (insert) | `401` / `503` |

## 2. Remediación aplicada

1. **Data API apagado** en Project Settings (control primario — el resto
   es defensa en profundidad, ver ADR-015).
2. `prisma/security/harden_public_grants.sql` versionado y aplicado a
   producción: `REVOKE ALL` sobre tablas/sequences/functions existentes +
   corrección de `ALTER DEFAULT PRIVILEGES` para que las tablas que cree
   cualquier `prisma migrate deploy` futuro no nazcan expuestas.
3. **28/28 sesiones administrativas activas revocadas** (expiradas, no
   borradas) — remediación conservadora ante la imposibilidad de descartar
   con certeza absoluta un acceso anterior a la ventana de logs.

## 3. Verificación funcional post-cambio

| Componente | Resultado |
|---|---|
| Data API | Apagada y confirmada: `503 PGRST002` (el servicio ni siquiera levanta) |
| apps/web | Funcionando — HTML real servido, catálogo con precios renderizado server-side |
| apps/admin | Funcionando — `/login` responde 200 con la página real de Better Auth |
| Better Auth (rol `postgres`) | Intacto — ciclo completo (crear user + session, join, borrar) sin errores de permisos |
| Pagos (rol `postgres`) | Intacto — `payments`/`orders`/`webhook_events` con SELECT/INSERT/UPDATE plenos para `postgres`, sin cambios (la revocación solo afecta a `anon`/`authenticated`) |
| `agent_api_role` | Sin cambios — mismos GRANTs verbo por verbo que antes del hardening |

## 4. Revisión de integridad — sin evidencia de compromiso

- **Conteos sin cambios** en las 17 tablas de negocio/sensibles frente a la
  línea base tomada al inicio de la auditoría (`orders`=2, `payments`=2,
  `entitlements`=2, `customers`=2, `checkout_sessions`=7,
  `webhook_events`=2, `admin_users`=1, `products`=1, `offers`=2,
  `prices`=4, `pages`=6, `api_clients`=0, `api_keys`=0,
  `agent_audit_logs`=0).
- **`payments`**: en ambas filas, `createdAt` == `updatedAt` exacto → nunca
  se modificaron desde que se crearon (7 de agosto). Sin tampering.
- **Cadena de negocio íntegra**: los 2 `customers` → 2 `orders` (PAID) →
  2 `payments` (APPROVED) → 2 `entitlements` (ACTIVE) referencian
  correctamente entre sí, todo fechado 7–9 de agosto; nada del período de
  esta auditoría se filtró a tablas reales.
- **Roles de Postgres**: exactamente el set estándar de Supabase +
  `agent_api_role` — ningún rol nuevo o inesperado.
- **Logs de API (ventana de 24h disponible)**: el único tráfico contra
  `/rest/v1/*` es tráfico propio de verificación (`curl/8.5.0`) durante
  esta auditoría; el resto son health-checks internos de Supabase
  (`@supabase-infra/mgmt-api`). Ningún llamador externo real registrado.
- **Sesiones admin**: patrón de una sola cuenta, con una IP humana
  recurrente y un clúster de IPs de un mismo bloque `/24` con
  HeadlessChrome concentrado en 36h (8–9 ago) — consistente con testing
  automatizado, no con un goteo sostenido de acceso externo.

### Limitación reconocida

La retención de logs disponible cubre 24h. El proyecto se creó el 7 de
agosto y estuvo expuesto desde entonces — no se puede descartar por logs un
acceso anterior a esa ventana. La revisión de integridad de datos
(timestamps y conteos), que sí cubre desde la creación del proyecto, no
mostró ninguna anomalía.

## 5. Conclusión

Sin indicios de explotación real de la exposición previa. Hardening
verificado en producción (`prisma/security/harden_public_grants.sql`,
commits `a11c655`, `d79cfb7`). Sesiones admin revocadas. RLS permanece
desactivado — decisión explícita, ver [ADR-015](../adr/ADR-015-data-api-rls-hardening.md)
para el razonamiento y las condiciones que la invalidarían.
