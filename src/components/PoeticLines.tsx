type Props = {
  lines: readonly string[];
  className?: string;
  lineClassName?: string;
  as?: "div" | "p";
};

export function PoeticLines({
  lines,
  className = "",
  lineClassName = "",
  as = "div",
}: Props) {
  const Tag = as;

  return (
    <Tag className={["poetic-lines", className].filter(Boolean).join(" ")}>
      {lines.map((line) => (
        <span key={line} className={["poetic-line", lineClassName].filter(Boolean).join(" ")}>
          {line}
        </span>
      ))}
    </Tag>
  );
}

export default PoeticLines;
