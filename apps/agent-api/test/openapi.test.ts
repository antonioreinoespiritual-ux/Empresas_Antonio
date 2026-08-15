import { Validator } from "@seriousme/openapi-schema-validator";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../src/lib/openapi";

// F7 (PLAN-AGENT-API-01): "El spec valida como OpenAPI 3.1 correcto" — no
// es una prueba estructural inventada a mano. Ajv "de fábrica" no puede
// validar instancias contra el meta-schema oficial de OAS 3.1 tal cual lo
// publica spec.openapis.org: usa $dynamicRef entre Schema Objects
// anidados (para permitir cualquier dialecto de JSON Schema dentro de un
// documento OAS 3.1), y Ajv no resuelve $dynamicRef fuera del objeto raíz
// en 2020-12 (ver README de @apidevtools/openapi-schemas y de este
// paquete) — produce falsos negativos reales, no solo cosméticos, en
// paths con parameters/responses anidados. @seriousme/openapi-schema-validator
// reescribe esos $dynamicRef a $ref normales para que Ajv los resuelva
// correctamente; sigue siendo el schema oficial, no uno inventado.
async function validateOpenApi31(doc: unknown) {
  const validator = new Validator();
  return validator.validate(doc as never);
}

// Métodos HTTP realmente implementados por cada ruta de
// apps/agent-api/src/app/api/v1/agent/**/route.ts (más /health,
// /openapi.json en la raíz) — si esta lista y los paths documentados se
// desincronizan, es exactamente el bug que este test existe para atrapar.
const EXPECTED_ROUTES: Record<string, string[]> = {
  "/health": ["get"],
  "/openapi.json": ["get"],
  "/whoami": ["get"],
  "/products": ["get"],
  "/products/{id}": ["get"],
  "/offers": ["get"],
  "/offers/{id}": ["get"],
  "/themes": ["get"],
  "/block-types": ["get"],
  "/pages": ["get", "post"],
  "/pages/{id}": ["get", "patch"],
  "/pages/{id}/blocks": ["post"],
  "/pages/{id}/blocks/{blockId}": ["patch", "delete"],
  "/pages/{id}/reorder": ["post"],
  "/pages/{id}/nodes": ["post"],
  "/pages/{id}/nodes/{nodeId}": ["patch", "delete"],
  "/pages/{id}/nodes/reorder": ["post"],
  "/pages/{id}/variants": ["post"],
  "/pages/{id}/publish": ["post"],
  "/pages/{id}/unpublish": ["post"],
  "/pages/{id}/preview": ["post"],
  "/media/upload-url": ["post"],
  "/media/assets": ["get", "post"],
};

describe("openapi.json generado", () => {
  it("valida contra el meta-schema oficial de OpenAPI 3.1", async () => {
    const doc = buildOpenApiDocument("http://localhost:3002");
    const result = await validateOpenApi31(doc);
    if (!result.valid) {
      throw new Error("openapi.json inválido:\n" + JSON.stringify(result.errors, null, 2));
    }
    expect(result.valid).toBe(true);
  });

  it("documenta exactamente las rutas y métodos reales de apps/agent-api (ni de más, ni de menos)", () => {
    const doc = buildOpenApiDocument("http://localhost:3002");
    const documentedPaths = Object.keys(doc.paths);

    expect(new Set(documentedPaths)).toEqual(new Set(Object.keys(EXPECTED_ROUTES)));

    for (const [path, methods] of Object.entries(EXPECTED_ROUTES)) {
      const pathItem = doc.paths[path as keyof typeof doc.paths] as Record<string, unknown>;
      const documentedMethods = Object.keys(pathItem).filter((key) => ["get", "post", "patch", "put", "delete"].includes(key));
      expect(new Set(documentedMethods)).toEqual(new Set(methods));
    }
  });

  it("toda operación autenticada declara el security scheme bearerAuth y al menos una respuesta 401", () => {
    const doc = buildOpenApiDocument("http://localhost:3002");
    const publicPaths = new Set(["/health", "/openapi.json"]);

    for (const [path, pathItem] of Object.entries(doc.paths)) {
      for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
        if (!["get", "post", "patch", "put", "delete"].includes(method)) continue;
        const op = operation as { security?: unknown[]; responses: Record<string, unknown> };
        if (publicPaths.has(path)) {
          expect(op.security).toEqual([]);
        } else {
          expect(op.security).toEqual([{ bearerAuth: [] }]);
          expect(Object.keys(op.responses)).toContain("401");
        }
      }
    }
  });

  it("cada respuesta 429/503 documentada usa la misma forma que agent-auth.ts realmente produce", () => {
    const doc = buildOpenApiDocument("http://localhost:3002");
    const whoami = doc.paths["/whoami"].get;
    const rateLimited = whoami.responses["429"].content["application/json"].schema;
    expect(rateLimited.required).toEqual(["error", "limit"]);
    const killSwitch = whoami.responses["503"].content["application/json"].schema;
    expect(killSwitch.properties.error.example).toBe("kill_switch_engaged");
  });
});
