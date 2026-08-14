export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading new quote">
      <div className="skeleton" style={{ height: 84 }} />
      <div className="grid twoUp">
        <div className="skeleton card" style={{ height: 620 }} />
        <div className="skeleton card" style={{ height: 620 }} />
      </div>
    </div>
  );
}
