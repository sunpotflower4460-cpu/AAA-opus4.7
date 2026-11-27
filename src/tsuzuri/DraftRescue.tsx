import { CopyTextButton } from "../components/CopyTextButton";
import { OriginalText } from "../components/OriginalText";
import { rescueMessages } from "../i18n/rescueMessages";
import type { UiLocale } from "../i18n/locales";
import { tsuzuriMessages } from "./messages";
import { bookOriginalText, coverTextFields, pieceText, type BookDraft } from "./model";

export function DraftRescue({ draft, locale }: { draft: BookDraft; locale: UiLocale }) {
  const c = tsuzuriMessages[locale];
  return (
    <div className="ts-list">
      <CopyTextButton label={c.copyOriginal} text={bookOriginalText(draft.cover, draft.passages)} feedback={rescueMessages[locale]} />
      {coverTextFields.map((field) => draft.cover[field] !== "" && (
        <OriginalText key={field} label={c[field]} text={draft.cover[field]} rows={2} />
      ))}
      {draft.passages.map((piece) => (
        <div key={piece.id} className="ts-list">
          <OriginalText label={c.currentPiece} text={pieceText(piece)} rows={4} />
          {piece.title && <CopyTextButton label={c.copyPieceTitle} text={piece.title} feedback={rescueMessages[locale]} />}
          <CopyTextButton label={c.copyPieceBody} text={piece.body} feedback={rescueMessages[locale]} />
        </div>
      ))}
    </div>
  );
}
