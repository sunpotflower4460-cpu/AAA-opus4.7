type Props = {
  active: boolean;
  token: string;
};

/**
 * 保存後のごく薄い円相。
 * 完了を派手に知らせるのではなく、墨が紙へ沈む時間を一呼吸だけ置く。
 */
export function SaveAfterglow({ active, token }: Props) {
  return (
    <div
      key={active ? token : "idle"}
      className="save-enso-afterglow"
      data-active={active ? "true" : "false"}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" role="presentation" focusable="false">
        <circle
          cx="32"
          cy="32"
          r="19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          transform="rotate(-24 32 32)"
        />
      </svg>
    </div>
  );
}

export default SaveAfterglow;
