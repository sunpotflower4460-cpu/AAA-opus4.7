type Props = {
  size?: number;
  className?: string;
  /** 円相を「呼吸」させるか */
  breathing?: boolean;
};

/**
 * 残心マーク — 円相（ensō）に金の小さな点を添えた、控えめなシンボル。
 * 派手にせず、静けさを壊さないように描く。
 */
export function ZanshinMark({
  size = 34,
  className,
  breathing = false,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="残心"
      className={[
        "block",
        breathing ? "animate-breath" : "",
        className ?? "",
      ].join(" ")}
    >
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="128 14"
        transform="rotate(-22 32 32)"
        opacity="0.85"
      />
      <circle cx="48" cy="18" r="2.2" fill="#C9A646" />
    </svg>
  );
}

export default ZanshinMark;
