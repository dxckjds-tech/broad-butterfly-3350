export function ComingSoonPanel({ title }: { title: string }) {
  return (
    <section className="wb-card" style={{ margin: 16 }}>
      <h3>{title}</h3>
      <p className="eyebrow">该模块尚未接入。当前版本保持 DRY_RUN，不写回 MIC，也不伪造搜索量或认证。</p>
    </section>
  );
}
