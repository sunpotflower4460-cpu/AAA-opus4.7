import { useEffect, useRef, useState } from "react";
import { copy } from "../lib/i18n";
import {
  PUBLIC_PAGES_BASE_URL,
  SUPPORT_ISSUES_URL,
  getAppVersionInfo,
  type AppVersionInfo,
} from "../lib/appInfo";

type Props = {
  onClose: () => void;
};

/**
 * 「このアプリについて」。保存方法・プライバシー・問い合わせ・バージョンを、アプリ内の本文だけで確認できる
 * （機内モードでも読める）。開いて閉じても、一覧の位置・検索語・保存状態には何も影響しない（重ねて表示する画面）。
 */
export function AboutScreen({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [version, setVersion] = useState<AppVersionInfo | null | "loading">("loading");

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;
    void getAppVersionInfo().then((info) => {
      if (!cancelled) setVersion(info);
    });
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const versionLabel =
    version === "loading"
      ? ""
      : version === null
        ? typeof window !== "undefined" && "Capacitor" in window
          ? copy.aboutVersionUnknown
          : copy.aboutVersionDev
        : `${version.version}${version.build ? `（${version.build}）` : ""}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zanshin-about-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-paper"
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-gr-4 py-gr-4">
        <header className="flex items-center justify-between gap-gr-3">
          <h2 id="zanshin-about-title" className="font-mincho text-[20px] tracking-mincho text-sumi">
            {copy.aboutTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] whitespace-nowrap rounded-full px-gr-4 py-gr-2 font-mincho text-[14px] text-sumi transition-soft hover:bg-washi"
          >
            {copy.aboutClose}
          </button>
        </header>

        <p className="mt-gr-3 text-[15px] leading-ample text-sumi">{copy.aboutLead}</p>

        <section aria-labelledby="about-storage" className="zanshin-about-section">
          <h3 id="about-storage">{copy.aboutStorageTitle}</h3>
          <p>{copy.aboutStorageBody}</p>
          <p>{copy.aboutStorageCaution}</p>
        </section>

        <section aria-labelledby="about-delete" className="zanshin-about-section">
          <h3 id="about-delete">{copy.aboutDeleteTitle}</h3>
          <p>{copy.aboutDeleteBody}</p>
        </section>

        <section aria-labelledby="about-pin" className="zanshin-about-section">
          <h3 id="about-pin">{copy.aboutPinTitle}</h3>
          <p>{copy.aboutPinBody}</p>
        </section>

        <section aria-labelledby="about-privacy" className="zanshin-about-section">
          <h3 id="about-privacy">{copy.aboutPrivacyTitle}</h3>
          <ul>
            {copy.aboutPrivacyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          {PUBLIC_PAGES_BASE_URL !== "" && (
            <p>
              <a href={`${PUBLIC_PAGES_BASE_URL}/privacy.html`} target="_blank" rel="noopener noreferrer">
                プライバシーポリシー（公開ページ）
              </a>
            </p>
          )}
        </section>

        <section aria-labelledby="about-support" className="zanshin-about-section">
          <h3 id="about-support">{copy.aboutSupportTitle}</h3>
          <p>{copy.aboutSupportBody}</p>
          <p>
            <a href={SUPPORT_ISSUES_URL} target="_blank" rel="noopener noreferrer">
              {copy.aboutSupportLink}
            </a>
          </p>
          <p className="text-ink-muted">{copy.aboutSupportHint}</p>
        </section>

        <p className="mt-gr-5 text-[14px] text-ink-muted">
          {copy.aboutVersion}：{versionLabel}
        </p>
      </div>
    </div>
  );
}

export default AboutScreen;
