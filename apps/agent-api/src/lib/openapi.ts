import { checkoutPageContentSchema, landingBlockSchema, landingBlocksContentSchema, thankYouPageContentSchema } from "@repo/core/domain";
import { zodToJsonSchema } from "zod-to-json-schema";

// F7 (PLAN-AGENT-API-01): "openapi.json generado a partir de los mismos
// schemas Zod (zod-to-json-schema) más paths escritos a mano". Solo el
// content de LANDING/CHECKOUT/THANK_YOU tiene un Zod schema real hoy — todo
// lo demás (parámetros, bodies de blocks/reorder/variants, respuestas) se
// describe a mano abajo, porque nunca existió como Zod en las rutas mismas
// (ver apps/agent-api/src/app/api/v1/agent/**/route.ts: la mayoría valida el
// body con chequeos manuales, no con z.object().parse()).
//
// $refStrategy "none": produce JSON Schema inline sin $defs/$ref propios —
// más simple de incrustar tal cual en components.schemas sin tener que
// fusionar el bag de $defs de cada llamada por separado.
const toJsonSchema = (schema: Parameters<typeof zodToJsonSchema>[0]) =>
  zodToJsonSchema(schema, { $refStrategy: "none", target: "jsonSchema2019-09" });

function errorSchema(exampleError: string, withDetail = false) {
  return {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string", example: exampleError },
      ...(withDetail ? { detail: { type: "string" } } : {}),
    },
  };
}

const RESPONSES = {
  Unauthorized: {
    description: "Credencial ausente, inválida, revocada o vencida.",
    content: { "application/json": { schema: errorSchema("invalid_credentials") } },
  },
  Forbidden: {
    description: "Autenticado pero sin permiso: cliente suspendido, forceReadOnly, scope faltante, u Offer fuera de allowedOfferIds.",
    content: { "application/json": { schema: errorSchema("missing_scope") } },
  },
  KillSwitch: {
    description: "Kill switch global activo (Edge Config o variable de entorno de respaldo) — ninguna request autenticada se procesa.",
    content: { "application/json": { schema: errorSchema("kill_switch_engaged") } },
  },
  NotFound: {
    description: "No existe, o existe pero está fuera de allowedOfferIds (nunca se distingue cuál, para no confirmar su existencia a quien no tiene acceso).",
    content: { "application/json": { schema: errorSchema("not_found") } },
  },
  RateLimited: {
    description: "Límite de requests por ventana superado para esta ApiKey+ruta.",
    content: { "application/json": { schema: { type: "object", required: ["error", "limit"], properties: { error: { type: "string", example: "rate_limited" }, limit: { type: "integer" } } } } },
  },
  BadRequest: {
    description: "Body o query inválidos.",
    content: { "application/json": { schema: errorSchema("invalid_body", true) } },
  },
  PreconditionRequired: {
    description: "Falta el header If-Match — toda escritura sobre una Page existente requiere la version esperada.",
    content: { "application/json": { schema: errorSchema("missing_if_match") } },
  },
  Conflict: {
    description: "Conflicto de versión (If-Match desactualizado) o de unicidad (offerId+kind+variantLabel duplicado).",
    content: { "application/json": { schema: errorSchema("version_conflict", true) } },
  },
} as const;

const RATE_LIMIT_INFO_SCHEMA = {
  type: "object",
  required: ["limit", "remaining"],
  properties: { limit: { type: "integer" }, remaining: { type: "integer" } },
};

const PRICE_SCHEMA = {
  type: "object",
  required: ["id", "offerId", "amount", "currency", "interval", "enabledProviders"],
  properties: {
    id: { type: "string" },
    offerId: { type: "string" },
    amount: { type: "integer", description: "Monto en la unidad mínima de la moneda (centavos)." },
    currency: { type: "string" },
    interval: { type: "string", enum: ["ONE_TIME", "RECURRING"] },
    enabledProviders: {
      oneOf: [{ type: "null" }, { type: "array", items: { type: "string", enum: ["WOMPI", "PAYPAL"] } }],
      description: "null = todos los proveedores técnicamente compatibles con currency.",
    },
  },
};

const PRODUCT_SCHEMA = {
  type: "object",
  required: ["id", "name", "type", "status"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    type: { type: "string", enum: ["DIGITAL", "PHYSICAL", "SERVICE", "SUBSCRIPTION"] },
    status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
  },
};

const OFFER_SCHEMA = {
  type: "object",
  required: ["id", "productId", "campaignId", "name", "isActive", "validFrom", "validTo", "themeId"],
  properties: {
    id: { type: "string" },
    productId: { type: "string" },
    campaignId: { oneOf: [{ type: "null" }, { type: "string" }] },
    name: { type: "string" },
    isActive: { type: "boolean" },
    validFrom: { oneOf: [{ type: "null" }, { type: "string", format: "date-time" }] },
    validTo: { oneOf: [{ type: "null" }, { type: "string", format: "date-time" }] },
    themeId: { type: "string", enum: ["premium-light", "premium-dark", "editorial", "high-conversion"] },
    prices: { type: "array", items: PRICE_SCHEMA },
  },
};

const PAGE_CONTENT_SCHEMA = {
  description: "La forma exacta depende de Page.kind — LANDING acepta bloques estructurados (o el formato legacy de campos sueltos), CHECKOUT/THANK_YOU son objetos fijos.",
  oneOf: [toJsonSchema(landingBlocksContentSchema), toJsonSchema(checkoutPageContentSchema), toJsonSchema(thankYouPageContentSchema)],
};

const PAGE_SCHEMA = {
  type: "object",
  required: ["id", "offerId", "kind", "slug", "status", "content", "version", "updatedAt", "variantGroupId", "variantLabel"],
  properties: {
    id: { type: "string" },
    offerId: { type: "string" },
    kind: { type: "string", enum: ["LANDING", "CHECKOUT", "THANK_YOU"] },
    slug: { oneOf: [{ type: "null" }, { type: "string" }] },
    status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
    content: PAGE_CONTENT_SCHEMA,
    version: { type: "integer", description: "Contador de concurrencia optimista — usar como valor del header If-Match en la siguiente escritura." },
    updatedAt: { type: "string", format: "date-time" },
    variantGroupId: { oneOf: [{ type: "null" }, { type: "string" }] },
    variantLabel: { oneOf: [{ type: "null" }, { type: "string" }], description: "null = Page primaria; presente = una variante A/B de ese grupo." },
  },
};

const BLOCK_TYPE_ENTRY_SCHEMA = {
  type: "object",
  required: ["type", "fields"],
  properties: {
    type: { type: "string" },
    fields: { type: "array", items: { type: "object" } },
  },
};

function paginated(itemsKey: string, itemSchema: object) {
  return {
    type: "object",
    required: [itemsKey, "nextCursor", "rateLimit"],
    properties: {
      [itemsKey]: { type: "array", items: itemSchema },
      nextCursor: { oneOf: [{ type: "null" }, { type: "string" }] },
      rateLimit: RATE_LIMIT_INFO_SCHEMA,
    },
  };
}

const CURSOR_PARAM = { name: "cursor", in: "query", schema: { type: "string" }, description: "Cursor devuelto como nextCursor en la página anterior." };
const LIMIT_PARAM = { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } };
const IF_MATCH_HEADER = {
  name: "If-Match",
  in: "header",
  required: true,
  schema: { type: "integer" },
  description: "Version actual de la Page (compare-and-swap) — se obtiene del último GET/escritura. 428 si falta, 409 si no coincide.",
};
const IDEMPOTENCY_HEADER = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: { type: "string" },
  description: "Reintentar con la misma key + mismo body devuelve la misma respuesta ya ejecutada, sin repetir la mutación.",
};
const PAGE_ID_PARAM = { name: "id", in: "path", required: true, schema: { type: "string" } };

function bearerSecured<T extends Record<string, unknown>>(operation: T) {
  return { security: [{ bearerAuth: [] as string[] }], ...operation };
}

/**
 * baseUrl: origen absoluto de la request real (`new URL(request.url).origin`
 * en la ruta) — el meta-schema oficial de OpenAPI 3.1 exige `format: "uri"`
 * en servers[].url, que requiere un scheme (RFC 3986); una URL relativa
 * como "/api/v1/agent" no valida contra ese schema pese a que la propia
 * prosa de la spec permite servers relativos. Reflejar el host real evita
 * hardcodear un dominio de producción que además cambiaría entre entornos
 * (local/staging/producción son proyectos de Vercel distintos).
 */
export function buildOpenApiDocument(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Empresas Antonio — Agent Access Layer API",
      version: "1.0.0",
      description:
        "API para que agentes externos (Claude/MCP), autenticados con su propia ApiKey, lean el catálogo (Products, Offers, Pages) y operen contenido de landing/checkout/thank-you de forma agentic — nunca con credenciales de AdminUser. Ver docs/roadmap/agent-access-layer.md para el detalle fase por fase del plan que construyó esta superficie (PLAN-AGENT-API-01).",
    },
    servers: [{ url: `${baseUrl}/api/v1/agent`, description: "Superficie autenticada" }, { url: baseUrl, description: "Raíz (health, openapi.json)" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "ApiKey emitida por un AdminUser vía apps/admin (panel /agents) — formato `Authorization: Bearer <keyPrefix>.<secret>`. Scopes: read, write, publish:pages.",
        },
      },
      schemas: {
        Product: PRODUCT_SCHEMA,
        Offer: OFFER_SCHEMA,
        Price: PRICE_SCHEMA,
        Page: PAGE_SCHEMA,
        LandingBlock: toJsonSchema(landingBlockSchema),
        RateLimitInfo: RATE_LIMIT_INFO_SCHEMA,
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "Liveness check — sin autenticación.",
          security: [],
          responses: { "200": { description: "OK.", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } } } } } } },
        },
      },
      "/openapi.json": {
        get: {
          summary: "Este documento — sin autenticación (un contrato no es un secreto).",
          security: [],
          responses: { "200": { description: "OK." } },
        },
      },
      "/whoami": {
        get: bearerSecured({
          summary: "Introspección de la identidad resuelta a partir del Authorization header.",
          responses: {
            "200": {
              description: "OK.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["apiClientId", "apiKeyId", "clientName", "scopes", "allowedOfferIds", "forceReadOnly", "rateLimit"],
                    properties: {
                      apiClientId: { type: "string" },
                      apiKeyId: { type: "string" },
                      clientName: { type: "string" },
                      scopes: { type: "array", items: { type: "string" } },
                      allowedOfferIds: { oneOf: [{ type: "null" }, { type: "array", items: { type: "string" } }] },
                      forceReadOnly: { type: "boolean" },
                      rateLimit: RATE_LIMIT_INFO_SCHEMA,
                    },
                  },
                },
              },
            },
            "401": RESPONSES.Unauthorized,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/products": {
        get: bearerSecured({
          summary: "Lista Products visibles para este ApiClient (acotado por allowedOfferIds vía sus Offers).",
          parameters: [CURSOR_PARAM, LIMIT_PARAM],
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: paginated("products", PRODUCT_SCHEMA) } } },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/products/{id}": {
        get: bearerSecured({
          summary: "Detalle de un Product.",
          parameters: [PAGE_ID_PARAM],
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: { type: "object", required: ["product"], properties: { product: PRODUCT_SCHEMA } } } } },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/offers": {
        get: bearerSecured({
          summary: "Lista Offers dentro de allowedOfferIds, con sus Prices embebidas.",
          parameters: [CURSOR_PARAM, LIMIT_PARAM],
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: paginated("offers", OFFER_SCHEMA) } } },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/offers/{id}": {
        get: bearerSecured({
          summary: "Detalle de una Offer. 403 offer_not_allowed si existe pero está fuera de allowedOfferIds (a diferencia de /pages/{id}, aquí el offerId ya se conoce desde la URL).",
          parameters: [PAGE_ID_PARAM],
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: { type: "object", required: ["offer"], properties: { offer: OFFER_SCHEMA } } } } },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/themes": {
        get: bearerSecured({
          summary: "Catálogo estático de ThemeId válidos.",
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: { type: "object", required: ["themes"], properties: { themes: { type: "array", items: { type: "string" } } } } } } },
            "401": RESPONSES.Unauthorized,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/block-types": {
        get: bearerSecured({
          summary: "Catálogo estático de los tipos de bloque de LANDING y sus campos.",
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: { type: "object", required: ["blockTypes"], properties: { blockTypes: { type: "array", items: BLOCK_TYPE_ENTRY_SCHEMA } } } } } },
            "401": RESPONSES.Unauthorized,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages": {
        get: bearerSecured({
          summary: "Lista Pages, opcionalmente filtradas por offerId/kind. offerId fuera de allowedOfferIds -> 403 antes de tocar la base.",
          parameters: [
            { name: "offerId", in: "query", schema: { type: "string" } },
            { name: "kind", in: "query", schema: { type: "string", enum: ["LANDING", "CHECKOUT", "THANK_YOU"] } },
            CURSOR_PARAM,
            LIMIT_PARAM,
          ],
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: paginated("pages", PAGE_SCHEMA) } } },
            "400": RESPONSES.BadRequest,
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
        post: bearerSecured({
          summary: "Crea una Page nueva (scope write, requiere Idempotency-Key). 409 si offerId+kind ya tiene una Page primaria.",
          parameters: [IDEMPOTENCY_HEADER],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["offerId", "kind", "content"],
                  properties: {
                    offerId: { type: "string" },
                    kind: { type: "string", enum: ["LANDING", "CHECKOUT", "THANK_YOU"] },
                    slug: { oneOf: [{ type: "null" }, { type: "string" }] },
                    content: PAGE_CONTENT_SCHEMA,
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Creada.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "400": RESPONSES.BadRequest,
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "409": RESPONSES.Conflict,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}": {
        get: bearerSecured({
          summary: "Detalle de una Page por id. 404 (no 403) si existe pero está fuera de allowedOfferIds.",
          parameters: [PAGE_ID_PARAM],
          responses: {
            "200": { description: "OK.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "401": RESPONSES.Unauthorized,
            "404": RESPONSES.NotFound,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
        patch: bearerSecured({
          summary: "Reemplaza el content completo de una Page existente vía CAS (If-Match).",
          parameters: [PAGE_ID_PARAM, IF_MATCH_HEADER, IDEMPOTENCY_HEADER],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["content"], properties: { content: PAGE_CONTENT_SCHEMA, slug: { oneOf: [{ type: "null" }, { type: "string" }] } } } } },
          },
          responses: {
            "200": { description: "Actualizada.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "400": RESPONSES.BadRequest,
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "409": RESPONSES.Conflict,
            "428": RESPONSES.PreconditionRequired,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}/blocks": {
        post: bearerSecured({
          summary: "Agrega un bloque al content de una Page LANDING (scope write, CAS vía If-Match).",
          parameters: [PAGE_ID_PARAM, IF_MATCH_HEADER, IDEMPOTENCY_HEADER],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["block"], properties: { block: toJsonSchema(landingBlockSchema) } } } } },
          responses: {
            "200": { description: "Bloque agregado.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "400": RESPONSES.BadRequest,
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "409": RESPONSES.Conflict,
            "428": RESPONSES.PreconditionRequired,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}/blocks/{blockId}": {
        patch: bearerSecured({
          summary: "Aplica un patch parcial a un bloque existente por su id.",
          parameters: [PAGE_ID_PARAM, { name: "blockId", in: "path", required: true, schema: { type: "string" } }, IF_MATCH_HEADER, IDEMPOTENCY_HEADER],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["patch"], properties: { patch: { type: "object" } } } } } },
          responses: {
            "200": { description: "Bloque actualizado.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "400": RESPONSES.BadRequest,
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "409": RESPONSES.Conflict,
            "428": RESPONSES.PreconditionRequired,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
        delete: bearerSecured({
          summary: "Elimina un bloque por su id.",
          parameters: [PAGE_ID_PARAM, { name: "blockId", in: "path", required: true, schema: { type: "string" } }, IF_MATCH_HEADER, IDEMPOTENCY_HEADER],
          responses: {
            "200": { description: "Bloque eliminado.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "409": RESPONSES.Conflict,
            "428": RESPONSES.PreconditionRequired,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}/reorder": {
        post: bearerSecured({
          summary: "Reordena los bloques del content según la lista completa de ids provista.",
          parameters: [PAGE_ID_PARAM, IF_MATCH_HEADER, IDEMPOTENCY_HEADER],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["orderedBlockIds"], properties: { orderedBlockIds: { type: "array", items: { type: "string" } } } } } },
          },
          responses: {
            "200": { description: "Reordenado.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "400": RESPONSES.BadRequest,
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "409": RESPONSES.Conflict,
            "428": RESPONSES.PreconditionRequired,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}/variants": {
        post: bearerSecured({
          summary: "Crea una variante A/B de una Page existente (mismo offerId+kind, variantLabel distinto). Sin If-Match — es una creación, no un CAS.",
          parameters: [PAGE_ID_PARAM, IDEMPOTENCY_HEADER],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["variantLabel"],
                  properties: {
                    variantLabel: { type: "string", minLength: 1 },
                    variantGroupId: { type: "string", description: "Si se omite, reusa el de la Page padre o genera uno nuevo." },
                    content: { ...PAGE_CONTENT_SCHEMA, description: "Si se omite, clona el content de la Page padre." },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Variante creada.", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "400": RESPONSES.BadRequest,
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "409": RESPONSES.Conflict,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}/publish": {
        post: bearerSecured({
          summary: "Publica una Page (scope publish:pages). Idempotente: si ya está PUBLISHED, 200 no-op con la misma forma.",
          parameters: [PAGE_ID_PARAM],
          responses: {
            "200": { description: "Publicada (o ya lo estaba).", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}/unpublish": {
        post: bearerSecured({
          summary: "Despublica una Page (scope publish:pages). Idempotente: si ya está DRAFT, 200 no-op con la misma forma.",
          parameters: [PAGE_ID_PARAM],
          responses: {
            "200": { description: "Despublicada (o ya lo estaba).", content: { "application/json": { schema: { type: "object", required: ["page"], properties: { page: PAGE_SCHEMA } } } } },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
      "/pages/{id}/preview": {
        post: bearerSecured({
          summary: "Emite un PreviewToken de un solo uso vigente (scope publish:pages). Funciona sin importar el status de la Page. Emitir uno nuevo revoca cualquier token vigente anterior de esa Page.",
          parameters: [PAGE_ID_PARAM],
          responses: {
            "201": {
              description: "Token emitido.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["previewUrl", "expiresAt"],
                    properties: { previewUrl: { type: "string", format: "uri" }, expiresAt: { type: "string", format: "date-time" } },
                  },
                },
              },
            },
            "401": RESPONSES.Unauthorized,
            "403": RESPONSES.Forbidden,
            "404": RESPONSES.NotFound,
            "429": RESPONSES.RateLimited,
            "503": RESPONSES.KillSwitch,
          },
        }),
      },
    },
  } as const;
}
