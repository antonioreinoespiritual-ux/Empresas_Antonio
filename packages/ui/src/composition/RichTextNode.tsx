import type { CSSProperties, ReactNode } from "react";
import type { RichTextMark, RichTextSpan } from "@repo/core/domain";
import { colorVar, ResponsiveStyleTag, stylePropsToBaseCss, TYPE_SCALE_PX } from "./style-runtime";
import type { RichTextNodeContent } from "./types";

// Serializa el árbol RichTextDoc (ARCH-LANDING-EDITOR-02 §6) a JSX puro —
// nunca dangerouslySetInnerHTML, nunca se parsea una cadena HTML. Cada mark
// es una envoltura de elemento semántico o un estilo inline derivado de un
// token, nunca CSS/HTML libre.
function renderSpan(span: RichTextSpan, key: number): ReactNode {
  let node: ReactNode = span.text;
  const inlineStyle: CSSProperties = {};
  let href: string | undefined;

  for (const mark of span.marks as RichTextMark[]) {
    if (mark === "bold") node = <strong>{node}</strong>;
    else if (mark === "italic") node = <em>{node}</em>;
    else if (mark === "underline") node = <u>{node}</u>;
    else if (mark === "strike") node = <s>{node}</s>;
    else if (mark === "highlight") node = <mark>{node}</mark>;
    else if (mark.type === "link") href = mark.href;
    else if (mark.type === "colorToken") inlineStyle.color = colorVar(mark.token);
    else if (mark.type === "sizeToken") inlineStyle.fontSize = TYPE_SCALE_PX[mark.token];
  }

  if (Object.keys(inlineStyle).length > 0) node = <span style={inlineStyle}>{node}</span>;
  if (href) node = <a href={href} className="underline">{node}</a>;

  // eslint-disable-next-line react/no-array-index-key -- los spans de un párrafo no tienen id propio, mismo criterio que LandingRenderer usa con `index`.
  return <span key={key}>{node}</span>;
}

const HEADING_SIZE_CLASS: Record<string, string> = {
  h1: "text-4xl sm:text-5xl font-semibold leading-tight",
  h2: "text-3xl sm:text-4xl font-semibold leading-tight",
  h3: "text-2xl font-semibold leading-snug",
  h4: "text-lg font-semibold leading-snug",
};

export function RichTextNode({ content }: { content: RichTextNodeContent }) {
  return (
    <div className="max-w-[65ch]" data-node-id={content.id} style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      {content.content.map((block, index) => {
        const spans = block.children.map((span, spanIndex) => renderSpan(span, spanIndex));
        if (block.style === "p") {
          // eslint-disable-next-line react/no-array-index-key -- los bloques de un RichTextDoc no tienen id propio.
          return (
            <p key={index} className="font-sans leading-relaxed">
              {spans}
            </p>
          );
        }
        const Tag = block.style as "h1" | "h2" | "h3" | "h4";
        return (
          // eslint-disable-next-line react/no-array-index-key -- los bloques de un RichTextDoc no tienen id propio.
          <Tag key={index} className={`font-display text-balance ${HEADING_SIZE_CLASS[block.style]}`}>
            {spans}
          </Tag>
        );
      })}
    </div>
  );
}
