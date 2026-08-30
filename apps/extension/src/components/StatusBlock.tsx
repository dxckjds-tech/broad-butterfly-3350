export function StatusBlock({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="status-block">
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
