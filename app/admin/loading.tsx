export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading admin console">
      <div className="skeleton" style={{ height: 92 }} />
      <div className="grid twoUp">
        <div className="skeleton card" style={{ height: 420 }} />
        <div className="skeleton card" style={{ height: 420 }} />
      </div>
      <div className="skeleton card" style={{ height: 200 }} />
    </div>
  );
}
