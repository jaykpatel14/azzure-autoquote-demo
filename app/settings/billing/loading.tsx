export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading billing settings">
      <div className="skeleton" style={{ height: 88 }} />
      <div className="skeleton line" style={{ width: "36%" }} />
      <div className="grid twoUp">
        <div className="skeleton card" />
        <div className="skeleton card" />
      </div>
      <div className="skeleton card" style={{ height: 420 }} />
    </div>
  );
}
