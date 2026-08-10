import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// F8 (PLAN-AGENT-API-01, ítems 45-58): "kill switch cronometrado" y "fallo
// inyectado de Edge Config". No hay un store de Edge Config real conectado
// todavía en ningún entorno de esta sesión (pendiente, ya señalado en
// PRs anteriores) — lo que sí se puede probar sin esa infraestructura es
// el propio mecanismo: TTL de caché de 15s exacto, fail-closed real al
// fallar la lectura (incluso con un valor cacheado previo distinto), y que
// el respaldo por variable de entorno corta el acceso de forma
// independiente. La medición real de "cuánto tarda una request en vivo en
// recibir 503" contra staging queda fuera de alcance hasta que ese store
// exista — ver docs/roadmap/agent-access-layer.md, cierre de F8.

const mockGet = vi.fn();
vi.mock("@vercel/edge-config", () => ({ get: (...args: unknown[]) => mockGet(...args) }));

async function freshKillSwitchModule() {
  vi.resetModules();
  const mod = await import("../src/lib/kill-switch");
  return mod.isKillSwitchEngaged;
}

describe("isKillSwitchEngaged", () => {
  beforeEach(() => {
    mockGet.mockReset();
    delete process.env.AGENT_API_KILL_SWITCH;
    delete process.env.EDGE_CONFIG;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin AGENT_API_KILL_SWITCH ni EDGE_CONFIG configurados, no bloquea (dev/local sin store)", async () => {
    const isKillSwitchEngaged = await freshKillSwitchModule();
    expect(await isKillSwitchEngaged()).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("AGENT_API_KILL_SWITCH=true bloquea sin consultar Edge Config", async () => {
    process.env.AGENT_API_KILL_SWITCH = "true";
    const isKillSwitchEngaged = await freshKillSwitchModule();
    expect(await isKillSwitchEngaged()).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("el respaldo por variable de entorno bloquea de forma independiente aunque Edge Config diga que no está activo", async () => {
    process.env.AGENT_API_KILL_SWITCH = "true";
    process.env.EDGE_CONFIG = "https://edge-config.example/test";
    mockGet.mockResolvedValue(false);
    const isKillSwitchEngaged = await freshKillSwitchModule();
    expect(await isKillSwitchEngaged()).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("lee Edge Config cuando hay EDGE_CONFIG configurado y respeta su valor", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.example/test";
    mockGet.mockResolvedValue(true);
    const isKillSwitchEngaged = await freshKillSwitchModule();
    expect(await isKillSwitchEngaged()).toBe(true);
    expect(mockGet).toHaveBeenCalledOnce();
  });

  it("cronometrado: cachea el resultado durante 15s exactos sin volver a consultar Edge Config", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.example/test";
    mockGet.mockResolvedValue(false);
    const isKillSwitchEngaged = await freshKillSwitchModule();

    expect(await isKillSwitchEngaged()).toBe(false);
    expect(mockGet).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(14_999);
    expect(await isKillSwitchEngaged()).toBe(false);
    expect(mockGet).toHaveBeenCalledOnce(); // todavía dentro de la ventana de 15s, no volvió a consultar

    vi.advanceTimersByTime(2); // total 15_001ms — ya vencido
    mockGet.mockResolvedValue(true); // simula que se activó mientras estaba cacheado
    expect(await isKillSwitchEngaged()).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(2); // recién ahora vuelve a consultar
  });

  it("fallo inyectado: si Edge Config falla, responde fail-closed (503) SIN importar el valor cacheado previo", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.example/test";
    mockGet.mockResolvedValue(false); // valor previo cacheado: NO bloqueado
    const isKillSwitchEngaged = await freshKillSwitchModule();

    expect(await isKillSwitchEngaged()).toBe(false);

    vi.advanceTimersByTime(15_001); // vence el caché
    mockGet.mockRejectedValue(new Error("Edge Config store inalcanzable (simulado)"));

    // Fail-closed real, no fail-open: un valor previo "false" cacheado
    // nunca debe filtrarse a la respuesta cuando la lectura falla.
    expect(await isKillSwitchEngaged()).toBe(true);
  });

  it("fallo inyectado sin ningún valor cacheado previo también es fail-closed", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.example/test";
    mockGet.mockRejectedValue(new Error("Edge Config store inalcanzable (simulado)"));
    const isKillSwitchEngaged = await freshKillSwitchModule();

    expect(await isKillSwitchEngaged()).toBe(true);
  });
});
