import { useId, useRef } from "react";
import { copy } from "../lib/i18n";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.trim().length > 0;

  return (
    <div
      className="zanshin-search-bar paper-surface transition-soft"
      onClick={(event) => {
        const target = event.target as Element;
        if (target.closest("button")) return;
        inputRef.current?.focus();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {copy.searchPlaceholder}
      </label>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-ink-muted/80"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M20 20l-3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={copy.searchPlaceholder}
        className="zanshin-search-input min-w-0 flex-1 bg-transparent text-[15px] text-sumi outline-none placeholder:text-ink-muted/68 jp-text-discipline"
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={copy.clearSearch}
          className="zanshin-clear-button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 7l10 10M17 7L7 17"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default SearchBar;
