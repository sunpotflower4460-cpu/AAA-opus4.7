import type { CSSProperties, RefObject } from "react";
import { ReadingText } from "../components/ReadingText";
import { brushFamily, paperId, paperTexture, PAPERS } from "./catalog";
import type { Appearance, Cover, TextSnapshot } from "./model";

export function BookPage({ appearance, text, cover, viewport }: {
  appearance: Appearance;
  text: Pick<TextSnapshot, "title" | "body">;
  cover?: Cover;
  viewport?: RefObject<HTMLDivElement>;
}) {
  const paper = PAPERS[paperId(appearance.paper)];
  const style = {
    "--book-ground": paper.ground, "--book-ink": paper.ink, "--book-grain": paper.rgb,
    "--book-brush": brushFamily(appearance.brush),
    "--book-texture": paperTexture(appearance.paper) ? `url("${paperTexture(appearance.paper)}")` : undefined,
  } as CSSProperties;
  function content(value: string) {
    return <ReadingText text={value} />;
  }
  return (
    <article className="ts-paper" data-paper={paperId(appearance.paper)} data-cover={cover ? appearance.cover : undefined}
      data-book-format={appearance.format} data-ink={appearance.ink} data-binding={appearance.binding} data-cover-direction={appearance.direction} style={style}>
      <div className="ts-paper-texture" aria-hidden="true" />
      {cover && (cover.title || cover.author || cover.date || cover.detail || cover.address || appearance.cover !== "plain") && (
        <header className="ts-cover" dir="auto" lang="">
          {cover.title && <h2>{cover.title}</h2>}
          {cover.author && <p>{cover.author}</p>}
          {cover.date && <p>{cover.date}</p>}
          {cover.address && <p>{cover.address}</p>}
          {cover.detail && <p className="ts-cover-detail">{cover.detail}</p>}
        </header>
      )}
      <div className="ts-reading" data-direction={appearance.direction} ref={viewport} tabIndex={viewport ? 0 : undefined}>
        {text.title && <h3 dir="auto" lang="">{content(text.title)}</h3>}
        <pre dir="auto" lang="">{content(text.body)}{text.body.endsWith("\n") && <span aria-hidden="true" className="ts-last-line" />}</pre>
      </div>
    </article>
  );
}
