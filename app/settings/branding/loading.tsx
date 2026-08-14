export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading branding settings">
      <div className="skeleton" style={{ height: 88 }} />
      <div className="grid twoUp">
        <div className="skeleton card" style={{ height: 300 }} />
        <div className="skeleton card" style={{ height: 300 }} />
      </div>
    </div>
  );
}
