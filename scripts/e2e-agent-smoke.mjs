// F8 (PLAN-AGENT-API-01, ítems 45-58): "no es donde se escriben las
// pruebas — la mayoría ya se escribieron dentro de F1-F5... esta fase es
// donde ocurren las dos pruebas que no pueden existir antes: un E2E con
// una key real (no la de seed) y una integración real con el MCP de
// Antonio." Este script es ese E2E — ejercita el ciclo agentic completo
// (leer catálogo → crear Page → agregar/editar/reordenar bloques →
// preview → publicar → publicar de nuevo (no-op) → despublicar) contra
// una instancia REAL de apps/agent-api vía HTTP, con una ApiKey real.
//
// La integración con el MCP real de Antonio (el otro ítem que "no puede
// existir antes") queda fuera de este script a propósito — solo él puede
// correr su propio agente contra esto; ver docs/roadmap/agent-access-layer.md.
//
// Uso:
//   AGENT_API_BASE_URL=http://localhost:3002 AGENT_API_KEY=ak_xxx.yyy \
//     node scripts/e2e-agent-smoke.mjs
//
// La ApiKey necesita los 3 scopes: read, write, publish:pages (ver
// packages/core/scripts/manage-agent-clients.mjs para emitir una de
// prueba, o el panel /agents de apps/admin).

const BASE_URL = process.env.AGENT_API_BASE_URL;
const API_KEY = process.env.AGENT_API_KEY;

if (!BASE_URL || !API_KEY) {
  console.error("Uso: AGENT_API_BASE_URL=<url> AGENT_API_KEY=<key> node scripts/e2e-agent-smoke.mjs");
  process.exit(1);
}

const results = [];

function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${step}${detail ? " — " + detail : ""}`);
}

async function request(method, path, { body, ifMatch, idempotencyKey } = {}) {
  const headers = { Authorization: `Bearer ${API_KEY}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (ifMatch !== undefined) headers["If-Match"] = String(ifMatch);
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function idem() {
  return `e2e-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function main() {
  const whoami = await request("GET", "/api/v1/agent/whoami");
  record("GET /whoami", whoami.status === 200, `scopes=${JSON.stringify(whoami.body?.scopes)}`);
  if (whoami.status !== 200) throw new Error("No se pudo autenticar — abortando el resto del smoke test");
  const scopes = whoami.body.scopes ?? [];
  for (const required of ["read", "write", "publish:pages"]) {
    record(`la key tiene scope "${required}"`, scopes.includes(required));
  }

  const products = await request("GET", "/api/v1/agent/products?limit=1");
  record("GET /products", products.status === 200, `${products.body?.products?.length ?? 0} producto(s)`);

  const offers = await request("GET", "/api/v1/agent/offers?limit=1");
  record("GET /offers", offers.status === 200, `${offers.body?.offers?.length ?? 0} offer(s)`);
  const offer = offers.body?.offers?.[0];
  if (!offer) throw new Error("No hay ninguna Offer visible para esta key — no se puede continuar con el ciclo de escritura");

  const themes = await request("GET", "/api/v1/agent/themes");
  record("GET /themes", themes.status === 200);

  const blockTypes = await request("GET", "/api/v1/agent/block-types");
  record("GET /block-types", blockTypes.status === 200, `${blockTypes.body?.blockTypes?.length ?? 0} tipo(s)`);

  // Página de trabajo: si ya existe una Page LANDING primaria para esta
  // Offer, se crea una variante (variantLabel único por corrida) en vez de
  // POST /pages directo, para no chocar con un 409 de unicidad en una
  // Offer que ya tiene contenido real.
  const existingPages = await request("GET", `/api/v1/agent/pages?offerId=${offer.id}&kind=LANDING`);
  record("GET /pages?offerId=&kind=LANDING", existingPages.status === 200);
  const primaryPage = existingPages.body?.pages?.find((p) => p.variantLabel === null);

  let page;
  if (primaryPage) {
    const variantLabel = `e2e-smoke-${Date.now()}`;
    const created = await request("POST", `/api/v1/agent/pages/${primaryPage.id}/variants`, {
      body: { variantLabel, content: { blocks: [{ type: "hero", id: "smoke-hero", title: "E2E smoke" }] } },
      idempotencyKey: idem(),
    });
    record("POST /pages/:id/variants (offer ya tenía Page primaria)", created.status === 201, `status=${created.status}`);
    page = created.body?.page;
  } else {
    const created = await request("POST", "/api/v1/agent/pages", {
      body: { offerId: offer.id, kind: "LANDING", content: { blocks: [{ type: "hero", id: "smoke-hero", title: "E2E smoke" }] } },
      idempotencyKey: idem(),
    });
    record("POST /pages (sin Page primaria previa)", created.status === 201, `status=${created.status}`);
    page = created.body?.page;
  }
  if (!page) throw new Error("No se pudo crear/obtener la Page de trabajo — abortando");

  const addBlock = await request("POST", `/api/v1/agent/pages/${page.id}/blocks`, {
    body: { block: { type: "cta", id: "smoke-cta", buttonLabel: "Comprar ahora" } },
    ifMatch: page.version,
    idempotencyKey: idem(),
  });
  record("POST /pages/:id/blocks", addBlock.status === 200, `status=${addBlock.status}`);
  let version = addBlock.body?.page?.version ?? page.version;

  const updateBlock = await request("PATCH", `/api/v1/agent/pages/${page.id}/blocks/smoke-cta`, {
    body: { patch: { buttonLabel: "Comprar ahora (E2E)" } },
    ifMatch: version,
    idempotencyKey: idem(),
  });
  record("PATCH /pages/:id/blocks/:blockId", updateBlock.status === 200, `status=${updateBlock.status}`);
  version = updateBlock.body?.page?.version ?? version;

  const reorder = await request("POST", `/api/v1/agent/pages/${page.id}/reorder`, {
    body: { orderedBlockIds: ["smoke-cta", "smoke-hero"] },
    ifMatch: version,
    idempotencyKey: idem(),
  });
  record("POST /pages/:id/reorder", reorder.status === 200, `status=${reorder.status}`);
  version = reorder.body?.page?.version ?? version;

  const preview = await request("POST", `/api/v1/agent/pages/${page.id}/preview`);
  record("POST /pages/:id/preview", preview.status === 201, preview.body?.previewUrl ?? `status=${preview.status}`);

  const publish = await request("POST", `/api/v1/agent/pages/${page.id}/publish`);
  record("POST /pages/:id/publish", publish.status === 200 && publish.body?.page?.status === "PUBLISHED", `status=${publish.status}`);

  const publishAgain = await request("POST", `/api/v1/agent/pages/${page.id}/publish`);
  record("POST /pages/:id/publish de nuevo es no-op 200 (idempotente)", publishAgain.status === 200, `status=${publishAgain.status}`);

  const unpublish = await request("POST", `/api/v1/agent/pages/${page.id}/unpublish`);
  record("POST /pages/:id/unpublish", unpublish.status === 200 && unpublish.body?.page?.status === "DRAFT", `status=${unpublish.status}`);

  const removeBlock = await request("DELETE", `/api/v1/agent/pages/${page.id}/blocks/smoke-cta`, {
    ifMatch: unpublish.body?.page?.version ?? version,
    idempotencyKey: idem(),
  });
  record("DELETE /pages/:id/blocks/:blockId (limpieza)", removeBlock.status === 200, `status=${removeBlock.status}`);
}

main()
  .catch((error) => {
    console.error("\nE2E smoke test abortado:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} pasos OK.`);
    if (failed.length > 0) {
      console.log("Fallidos:", failed.map((f) => f.step).join(", "));
      process.exitCode = 1;
    }
  });
