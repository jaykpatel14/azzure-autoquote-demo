export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading workspace">
      <div className="skeleton" style={{ height: 96 }} />
      <div className="skeleton line" style={{ width: "42%" }} />
      <div className="skeleton line" style={{ width: "64%" }} />
      <div className="grid twoUp">
        <div className="skeleton card" />
        <div className="skeleton card" />
      </div>
      <div className="skeleton card" style={{ height: 420 }} />
    </div>
  );
}
