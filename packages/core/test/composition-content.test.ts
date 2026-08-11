import { describe, expect, it } from "vitest";
import {
  DomainError,
  compositionContentSchema,
  compositionRootSchema,
  parsePageContent,
  richTextDocSchema,
  safeLinkUrlSchema,
  stylePropsSchema,
  toLandingBlocks,
  type LandingPageContent,
} from "../src/domain";

function minimalSection(children: unknown[] = [{ type: "spacer", id: "el-1", content: {} }]) {
  return { type: "section", id: "sec-1", children: [{ type: "row", id: "row-1", children }] };
}

describe("Composition — schema de árbol de nodos (ARCH-LANDING-EDITOR-02)", () => {
  it("valida una Composition mínima (section > row > elemento)", () => {
    const raw = { version: "composition-1", root: [minimalSection()] };
    expect(compositionContentSchema.parse(raw)).toEqual(raw);
  });

  it("rechaza una raíz vacía", () => {
    expect(() => compositionRootSchema.parse([])).toThrow();
  });

  it("rechaza un elemento suelto directamente en la raíz (debe ser section)", () => {
    expect(() => compositionRootSchema.parse([{ type: "spacer", id: "x", content: {} }])).toThrow();
  });

  it("rechaza una section sin ninguna row", () => {
    expect(() => compositionRootSchema.parse([{ type: "section", id: "s1", children: [] }])).toThrow();
  });

  describe("profundidad máxima (P-1, aprobada: 4 niveles)", () => {
    it("acepta una row anidada dentro de otra row (nivel 3→4)", () => {
      const nestedRow = {
        type: "row",
        id: "inner-row",
        children: [{ type: "spacer", id: "el-1", content: {} }],
      };
      const raw = { version: "composition-1", root: [minimalSection([nestedRow])] };
      expect(() => compositionContentSchema.parse(raw)).not.toThrow();
    });

    it("rechaza una row anidada dentro de una row ya anidada (5º nivel) — garantía estructural, no un walker aparte", () => {
      const doublyNestedRow = {
        type: "row",
        id: "inner-row",
        children: [{ type: "row", id: "too-deep", children: [{ type: "spacer", id: "el-1", content: {} }] }],
      };
      const raw = { version: "composition-1", root: [minimalSection([doublyNestedRow])] };
      expect(() => compositionContentSchema.parse(raw)).toThrow();
    });
  });

  describe("nodos elemento", () => {
    it("richText: valida contenido y rechaza un mark desconocido", () => {
      const node = {
        type: "richText",
        id: "rt-1",
        content: [{ style: "p", children: [{ text: "hola", marks: ["bold"] }] }],
      };
      const raw = { version: "composition-1", root: [minimalSection([node])] };
      expect(() => compositionContentSchema.parse(raw)).not.toThrow();

      const invalid = {
        ...node,
        content: [{ style: "p", children: [{ text: "hola", marks: ["subrayado-inventado"] }] }],
      };
      expect(() => compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([invalid])] })).toThrow();
    });

    it("image: requiere assetId y altText", () => {
      const valid = { type: "image", id: "img-1", content: { assetId: "asset_1", altText: "Descripción" } };
      expect(() => compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([valid])] })).not.toThrow();

      const missingAlt = { type: "image", id: "img-1", content: { assetId: "asset_1" } };
      expect(() =>
        compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([missingAlt])] })
      ).toThrow();
    });

    it("video: acepta fuente embed o asset propio, rechaza una fuente sin kind válido", () => {
      const embed = { type: "video", id: "v-1", content: { source: { kind: "embed", embedUrl: "https://youtube.com/x" } } };
      const ownAsset = { type: "video", id: "v-2", content: { source: { kind: "asset", assetId: "asset_1" } } };
      expect(() => compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([embed])] })).not.toThrow();
      expect(() =>
        compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([ownAsset])] })
      ).not.toThrow();

      const invalid = { type: "video", id: "v-3", content: { source: { kind: "ftp", url: "ftp://x" } } };
      expect(() => compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([invalid])] })).toThrow();
    });

    it("button: usa safeLinkUrlSchema y rechaza javascript:", () => {
      const valid = { type: "button", id: "btn-1", content: { label: "Comprar", href: "https://example.com/comprar" } };
      expect(() => compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([valid])] })).not.toThrow();

      const xss = { type: "button", id: "btn-2", content: { label: "Comprar", href: "javascript:alert(1)" } };
      expect(() => compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([xss])] })).toThrow();
    });

    it("legacyBlock: envuelve un LandingBlock existente (hero) tal cual, y rechaza un tipo de bloque inválido", () => {
      const wrapped = {
        type: "legacyBlock",
        id: "lb-1",
        content: { block: { type: "hero", id: "b1", title: "Título", ctaLabel: "Comprar ahora" } },
      };
      expect(() =>
        compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([wrapped])] })
      ).not.toThrow();

      const invalidBlock = { type: "legacyBlock", id: "lb-2", content: { block: { type: "no-existe" } } };
      expect(() =>
        compositionContentSchema.parse({ version: "composition-1", root: [minimalSection([invalidBlock])] })
      ).toThrow();
    });

    it("gallery: requiere al menos 1 item con assetId+altText", () => {
      expect(() =>
        compositionContentSchema.parse({
          version: "composition-1",
          root: [minimalSection([{ type: "gallery", id: "g1", content: { items: [] } }])],
        })
      ).toThrow();
    });
  });

  describe("style tokens (StyleProps) — siempre cerrados, nunca CSS libre", () => {
    it("acepta tokens válidos, incluido un override responsive de 1 nivel", () => {
      const style = {
        spacing: { top: "lg" },
        color: { textToken: "primary" },
        typography: { sizeToken: "xl", alignToken: "center" },
        responsive: { md: { typography: { sizeToken: "md" } } },
      };
      expect(() => stylePropsSchema.parse(style)).not.toThrow();
    });

    it("rechaza un token de color fuera de la lista cerrada", () => {
      expect(() => stylePropsSchema.parse({ color: { textToken: "purple-inventado" } })).toThrow();
    });

    it("rechaza columnSpan fuera de 1-12", () => {
      expect(() => stylePropsSchema.parse({ layout: { columnSpan: 13 } })).toThrow();
      expect(() => stylePropsSchema.parse({ layout: { columnSpan: 0 } })).toThrow();
      expect(() => stylePropsSchema.parse({ layout: { columnSpan: 12 } })).not.toThrow();
    });

    it("una clave de CSS libre no declarada se descarta silenciosamente, no se persiste (comportamiento ya estándar en el resto del dominio, sin .strict())", () => {
      const parsed = stylePropsSchema.parse({ arbitraryCss: "color: red" } as never);
      expect(parsed).not.toHaveProperty("arbitraryCss");
    });
  });

  describe("safeLinkUrlSchema", () => {
    it("acepta https y mailto", () => {
      expect(() => safeLinkUrlSchema.parse("https://example.com")).not.toThrow();
      expect(() => safeLinkUrlSchema.parse("mailto:hola@example.com")).not.toThrow();
    });

    it("rechaza javascript: y data:", () => {
      expect(() => safeLinkUrlSchema.parse("javascript:alert(1)")).toThrow();
      expect(() => safeLinkUrlSchema.parse("data:text/html,<script>alert(1)</script>")).toThrow();
    });
  });

  describe("richTextDocSchema: múltiples marks combinados en el mismo párrafo", () => {
    it("acepta spans distintos con estilos distintos dentro del mismo bloque de párrafo", () => {
      const doc = [
        {
          style: "p",
          children: [
            { text: "negro normal ", marks: [] },
            { text: "rojo y grande ", marks: [{ type: "colorToken", token: "destructive" }, { type: "sizeToken", token: "xl" }] },
            { text: "negrita", marks: ["bold", "highlight"] },
          ],
        },
      ];
      expect(() => richTextDocSchema.parse(doc)).not.toThrow();
    });
  });

  describe("integración con parsePageContent/toLandingBlocks — sin afectar legacy/blocks existentes", () => {
    it("parsePageContent(LANDING) reconoce composition-1 sin confundirlo con blocks/legacy", () => {
      const raw = { version: "composition-1", root: [minimalSection()] };
      const parsed = parsePageContent("LANDING", raw) as LandingPageContent;
      expect(parsed).toEqual(raw);
    });

    it("toLandingBlocks lanza DomainError explícito para contenido composition-1 (no un crash de campo undefined)", () => {
      const content = { version: "composition-1" as const, root: [minimalSection()] };
      expect(() => toLandingBlocks(content as LandingPageContent)).toThrow(DomainError);
    });

    it("Pages legacy y blocks existentes siguen parseando exactamente igual que antes (regresión cero)", () => {
      const legacyRaw = { heroTitle: "Título", bodyHtml: "<p>x</p>" };
      const blocksRaw = { blocks: [{ type: "hero", id: "b1", title: "Título", ctaLabel: "Comprar ahora" }] };
      expect(parsePageContent("LANDING", legacyRaw)).toEqual({
        heroTitle: "Título",
        heroSubtitle: "",
        bodyHtml: "<p>x</p>",
        ctaLabel: "Comprar ahora",
      });
      expect(parsePageContent("LANDING", blocksRaw)).toEqual(blocksRaw);
    });
  });
});
