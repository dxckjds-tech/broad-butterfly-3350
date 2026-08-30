export function ScoreCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="score-card">
      <span className="score-card__label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
