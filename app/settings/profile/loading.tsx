export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading profile settings">
      <div className="skeleton" style={{ height: 88 }} />
      <div className="grid twoUp">
        <div className="skeleton card" style={{ height: 320 }} />
        <div className="skeleton card" style={{ height: 320 }} />
      </div>
    </div>
  );
}
