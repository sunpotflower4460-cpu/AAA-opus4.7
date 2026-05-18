import { copy } from "../lib/i18n";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  return (
    <label
      className="
        flex items-center gap-gr-3 rounded-full bg-paper/70
        px-gr-4 py-gr-3 shadow-paper-soft
        border border-[color:var(--color-line)]
        transition-soft
        focus-within:bg-paper
        focus-within:border-indigo/30
        focus-within:shadow-paper
      "
    >
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
        type="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.searchPlaceholder}
        className="text-[15px] text-sumi placeholder:text-ink-muted/68"
      />
    </label>
  );
}

export default SearchBar;
