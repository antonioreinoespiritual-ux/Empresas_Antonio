import { describe, expect, it } from "vitest";
import { createMediaUploadUrl, registerAsset, type AssetRepository, type CreateAssetInput, type MediaStorage } from "../src/application";
import type { Asset } from "../src/domain";

// Fakes en memoria (no Prisma, no Supabase Storage real) — Fase 5: la
// lógica de generación de path/validación de content-type y de cómputo de
// `url` server-side es pura orquestación, testeable sin ningún I/O real.
// La llamada real a Supabase Storage (createSignedUploadUrl en vivo)
// requiere el bucket que Antonio provisiona — no se verifica acá, ver
// docs/roadmap/landing-editor-v2.md Fase 5.
function fakeMediaStorage(): MediaStorage {
  return {
    async createUploadUrl(input) {
      return { uploadUrl: `https://storage.test/upload/${input.path}?contentType=${input.contentType}`, expiresAt: new Date("2030-01-01") };
    },
    publicUrlFor(path) {
      return `https://storage.test/public/${path}`;
    },
  };
}

function fakeAssetRepository(): AssetRepository & { rows: Asset[] } {
  const rows: Asset[] = [];
  return {
    rows,
    async create(input: CreateAssetInput) {
      const asset: Asset = { id: `asset_${rows.length + 1}`, createdAt: new Date(), ...input };
      rows.push(asset);
      return asset;
    },
    async findById(assetId) {
      return rows.find((a) => a.id === assetId) ?? null;
    },
    async findByIds(assetIds) {
      return rows.filter((a) => assetIds.includes(a.id));
    },
    async list(input) {
      return { items: rows.slice(0, input.limit), nextCursor: null };
    },
  };
}

describe("createMediaUploadUrl", () => {
  it("genera un path aleatorio bajo el prefijo del kind, con la extensión correcta", async () => {
    const result = await createMediaUploadUrl({ media: fakeMediaStorage() }, { kind: "IMAGE", contentType: "image/png" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toMatch(/^image\/[0-9a-f]{32}\.png$/);
    expect(result.uploadUrl).toContain(result.path);
  });

  it("rechaza un content-type no soportado para ese kind", async () => {
    const result = await createMediaUploadUrl({ media: fakeMediaStorage() }, { kind: "IMAGE", contentType: "application/pdf" });
    expect(result).toEqual({ ok: false, reason: "unsupported_content_type" });
  });

  it("rechaza un content-type de video pasado con kind IMAGE (las listas están separadas por kind)", async () => {
    const result = await createMediaUploadUrl({ media: fakeMediaStorage() }, { kind: "IMAGE", contentType: "video/mp4" });
    expect(result).toEqual({ ok: false, reason: "unsupported_content_type" });
  });
});

describe("registerAsset", () => {
  it("computa la url desde el path vía MediaStorage.publicUrlFor, nunca desde un valor suelto del caller", async () => {
    const assets = fakeAssetRepository();
    const asset = await registerAsset(
      { assets, media: fakeMediaStorage() },
      { kind: "IMAGE", path: "image/abc123.png", width: 800, height: 600, altText: "Una foto" }
    );

    expect(asset.url).toBe("https://storage.test/public/image/abc123.png");
    expect(asset.provider).toBe("supabase-storage");
    expect(assets.rows).toHaveLength(1);
  });
});
