import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import { PUBLIC_UI_LOCALES, type LanguagePreference } from "../i18n/locales";
import {
  PUBLIC_PAGES_BASE_URL,
  SUPPORT_ISSUES_URL,
  getAppVersionInfo,
  type AppVersionInfo,
} from "../lib/appInfo";
import { handleModalKeyDown } from "./modalKeyboard";

type Props = {
  onClose: () => void;
};

/**
 * 「このアプリについて」。保存方法・プライバシー・問い合わせ・バージョンを、アプリ内の本文だけで確認できる
 * （機内モードでも読める）。開いて閉じても、一覧の位置・検索語・保存状態には何も影響しない（重ねて表示する画面）。
 */
export function AboutScreen({ onClose }: Props) {
  const { copy, language, languageWriteFailed, locale, preferences } = useI18n();
  const languageId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [version, setVersion] = useState<AppVersionInfo | null | "loading" | "web">("loading");

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
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

  const versionLabel = version === "loading" ? ""
    : version === "web" ? copy.aboutVersionDev
    : version === null ? copy.aboutVersionUnknown
    : `${version.version}${version.build ? ` (${version.build})` : ""}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zanshin-about-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-paper"
      onKeyDown={(event) => handleModalKeyDown(event, onClose)}
    >
      <div className="zanshin-info-panel mx-auto flex min-h-full w-full max-w-[560px] flex-col px-gr-4">
        <header className="flex items-center justify-between gap-gr-3">
          <h2 id="zanshin-about-title" className="font-mincho text-[20px] tracking-mincho text-sumi">
            {copy.appName}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] whitespace-nowrap rounded-full px-gr-4 py-gr-2 font-mincho text-[14px] text-sumi transition-soft hover:bg-washi"
          >
            {copy.close}
          </button>
        </header>

        <p className="mt-gr-3 text-[15px] leading-ample text-sumi">{copy.aboutLead}</p>

        <section className="zanshin-about-section">
          <label htmlFor={languageId} className="block text-sumi">{copy.language}</label>
          <select
            id={languageId}
            value={language}
            onChange={(event) => preferences.selectLanguage(event.currentTarget.value as LanguagePreference)}
            className="mt-gr-2 min-h-[44px] max-w-full rounded-lg border border-[color:var(--color-line)] bg-washi px-gr-3 py-gr-2 text-sumi"
          >
            <option value="system">{copy.followSystem}</option>
            {PUBLIC_UI_LOCALES.map((available) => (
              <option key={available} value={available} lang={available}>{available === "ja" ? "日本語" : "English"}</option>
            ))}
          </select>
          {languageWriteFailed && <p role="status" className="mt-gr-2">{copy.preferenceWriteFailed}</p>}
        </section>

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
            {copy.aboutPrivacyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
          {PUBLIC_PAGES_BASE_URL !== "" && (
            <p>
              <a href={`${PUBLIC_PAGES_BASE_URL}/privacy${locale === "en" ? "-en" : ""}.html`} target="_blank" rel="noopener noreferrer">
                {copy.aboutPrivacyLink}
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

        <dl className="mt-gr-5 text-sm text-ink-muted">
          <dt>{copy.aboutVersion}</dt>
          <dd>{versionLabel}</dd>
        </dl>
      </div>
    </div>
  );
}

export default AboutScreen;
