export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading team settings">
      <div className="skeleton" style={{ height: 88 }} />
      <div className="grid twoUp">
        <div className="skeleton card" style={{ height: 360 }} />
        <div className="skeleton card" style={{ height: 360 }} />
      </div>
    </div>
  );
}
