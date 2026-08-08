import { Container, Section, VideoFrame } from "../primitives";
import type { VslBlockContent } from "./types";

export function VslBlock({ content }: { content: VslBlockContent }) {
  return (
    <Section tone="base">
      <Container width="content">
        <VideoFrame embedUrl={content.embedUrl} posterImageUrl={content.posterImageUrl} autoplay={content.autoplay} />
      </Container>
    </Section>
  );
}
