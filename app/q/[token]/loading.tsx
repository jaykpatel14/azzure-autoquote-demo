export default function Loading() {
  return (
    <main className="publicQuoteShell">
      <article className="publicQuoteCard card" aria-label="Loading quote">
        <div className="stack">
          <div className="skeleton line" style={{ width: "40%", margin: "0 auto" }} />
          <div className="skeleton card" style={{ height: 220 }} />
          <div className="skeleton card" style={{ height: 160 }} />
        </div>
      </article>
    </main>
  );
}
