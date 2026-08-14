export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading cancellation page">
      <div className="skeleton" style={{ height: 88 }} />
      <div className="skeleton card" style={{ height: 180 }} />
      <div className="skeleton card" style={{ height: 220 }} />
    </div>
  );
}
