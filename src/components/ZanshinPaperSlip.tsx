type Props = {
  lines: readonly [string, ...string[]];
  englishLine?: string;
};

export function ZanshinPaperSlip({ lines, englishLine }: Props) {
  return (
    <div className="zanshin-paper-slip">
      <p className="zanshin-main-copy font-mincho text-sumi">
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      {englishLine ? <p className="zanshin-paper-slip-en english-subcopy">{englishLine}</p> : null}
    </div>
  );
}

export default ZanshinPaperSlip;
