export default function Loading() {
  return (
    <div className="appLoading" aria-label="Loading onboarding">
      <div className="skeleton" style={{ height: 88 }} />
      <div className="skeleton card" style={{ height: 200 }} />
      <div className="skeleton card" style={{ height: 260 }} />
      <div className="skeleton card" style={{ height: 220 }} />
    </div>
  );
}
