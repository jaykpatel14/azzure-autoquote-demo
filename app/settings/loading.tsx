export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading settings">
      <div className="skeleton" style={{ height: 90 }} />
      <div className="skeleton line" style={{ width: "40%" }} />
      <div className="grid twoUp">
        <div className="skeleton card" />
        <div className="skeleton card" />
      </div>
      <div className="skeleton card" style={{ height: 460 }} />
    </div>
  );
}
