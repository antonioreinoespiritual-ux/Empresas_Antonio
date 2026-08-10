import { describe, expect, it } from "vitest";
import { DomainError, parsePageContent, toLandingBlocks, type LandingPageContent } from "../src/domain";

describe("parsePageContent(LANDING): acepta legacy y blocks sin forzar migración en escritura", () => {
  it("valida y conserva intacta la forma legacy (heroTitle/bodyHtml/etc.)", () => {
    const raw = {
      heroTitle: "Título",
      heroSubtitle: "Subtítulo",
      vslEmbedUrl: "https://youtube.com/embed/abc",
      bodyHtml: "<p>Copy existente</p>",
      ctaLabel: "Comprar ya",
    };

    const parsed = parsePageContent("LANDING", raw);
    expect(parsed).toEqual(raw);
  });

  it("aplica defaults de la forma legacy cuando faltan campos opcionales", () => {
    const parsed = parsePageContent("LANDING", { heroTitle: "Solo título" }) as LandingPageContent;
    expect(parsed).toEqual({
      heroTitle: "Solo título",
      heroSubtitle: "",
      bodyHtml: "",
      ctaLabel: "Comprar ahora",
    });
  });

  it("valida la forma de bloques cuando el content trae `blocks`", () => {
    const raw = {
      blocks: [
        { type: "hero", id: "b1", title: "Título", ctaLabel: "Comprar ahora" },
        { type: "richText", id: "b2", html: "<p>Hola</p>" },
      ],
    };

    const parsed = parsePageContent("LANDING", raw);
    expect(parsed).toEqual(raw);
  });

  it("rechaza un content de bloques inválido (tipo de bloque desconocido)", () => {
    expect(() => parsePageContent("LANDING", { blocks: [{ type: "unknown" }] })).toThrow();
  });

  it("rechaza legacy sin heroTitle", () => {
    expect(() => parsePageContent("LANDING", { bodyHtml: "<p>x</p>" })).toThrow();
  });
});

describe("toLandingBlocks: proyección de lectura no destructiva", () => {
  it("devuelve los blocks tal cual cuando el content ya está en esa forma", () => {
    const content: LandingPageContent = {
      blocks: [{ type: "richText", id: "b1", html: "<p>x</p>" }],
    };
    expect(toLandingBlocks(content)).toEqual(content.blocks);
  });

  it("convierte legacy completo (hero + vsl + bodyHtml) preservando todo el copy", () => {
    const content: LandingPageContent = {
      heroTitle: "Título",
      heroSubtitle: "Subtítulo",
      vslEmbedUrl: "https://youtube.com/embed/abc",
      bodyHtml: "<p>Copy existente</p>",
      ctaLabel: "Comprar ya",
    };

    expect(toLandingBlocks(content)).toEqual([
      { type: "hero", id: "legacy-hero", title: "Título", subtitle: "Subtítulo", ctaLabel: "Comprar ya" },
      { type: "vsl", id: "legacy-vsl", embedUrl: "https://youtube.com/embed/abc", autoplay: false },
      { type: "richText", id: "legacy-richtext", html: "<p>Copy existente</p>" },
    ]);
  });

  it("no pierde bodyHtml cuando no hay vslEmbedUrl", () => {
    const content: LandingPageContent = {
      heroTitle: "Título",
      heroSubtitle: "",
      bodyHtml: "<p>Solo body</p>",
      ctaLabel: "Comprar ahora",
    };

    const blocks = toLandingBlocks(content);
    expect(blocks).toContainEqual({ type: "richText", id: "legacy-richtext", html: "<p>Solo body</p>" });
    expect(blocks).toHaveLength(2);
  });

  it("omite el bloque richText cuando bodyHtml está vacío (sin inventar contenido)", () => {
    const content: LandingPageContent = {
      heroTitle: "Título",
      heroSubtitle: "",
      bodyHtml: "",
      ctaLabel: "Comprar ahora",
    };

    expect(toLandingBlocks(content)).toEqual([
      { type: "hero", id: "legacy-hero", title: "Título", subtitle: undefined, ctaLabel: "Comprar ahora" },
    ]);
  });
});

describe("parsePageContent: PageKind desconocido sigue siendo un DomainError explícito", () => {
  it("CHECKOUT y THANK_YOU no se ven afectados por el cambio de LANDING", () => {
    expect(parsePageContent("CHECKOUT", {})).toEqual({ headline: "", subheadline: "" });
    expect(parsePageContent("THANK_YOU", {})).toEqual({ title: "¡Gracias por tu compra!", message: "" });
  });

  it("lanza DomainError para un kind fuera del enum en runtime", () => {
    expect(() => parsePageContent("UNKNOWN" as never, {})).toThrow(DomainError);
  });
});
