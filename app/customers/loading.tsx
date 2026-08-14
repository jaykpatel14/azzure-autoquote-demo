export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading customers">
      <div className="skeleton" style={{ height: 84 }} />
      <div className="grid twoUp">
        <div className="skeleton card" />
        <div className="skeleton card" />
      </div>
      <div className="skeleton card" style={{ height: 420 }} />
    </div>
  );
}
