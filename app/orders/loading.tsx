export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading orders">
      <div className="skeleton" style={{ height: 84 }} />
      <div className="grid twoUp">
        <div className="skeleton card" />
        <div className="skeleton card" />
      </div>
      <div className="skeleton card" style={{ height: 480 }} />
    </div>
  );
}
