export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading quotes">
      <div className="skeleton" style={{ height: 84 }} />
      <div className="skeleton line" style={{ width: "36%" }} />
      <div className="skeleton line" style={{ width: "58%" }} />
      <div className="grid twoUp">
        <div className="skeleton card" />
        <div className="skeleton card" />
      </div>
      <div className="skeleton card" style={{ height: 520 }} />
    </div>
  );
}
