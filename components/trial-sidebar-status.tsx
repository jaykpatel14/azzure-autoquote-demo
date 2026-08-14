type TrialSidebarStatusProps = {
  daysRemaining: number;
  quoteCap: number;
  quotesRemaining: number;
  urgent?: boolean;
};

export default function TrialSidebarStatus({
  daysRemaining,
  quoteCap,
  quotesRemaining,
  urgent = false
}: TrialSidebarStatusProps) {
  const totalUsed = quoteCap - quotesRemaining;
  const progress = Math.max(0, Math.min(100, (totalUsed / quoteCap) * 100));

  return (
    <section className={urgent ? "sidebarPanel trialSidebarStatus trialSidebarStatus--urgent" : "sidebarPanel trialSidebarStatus"}>
      <p className="eyebrow">Trial</p>
      <strong>{daysRemaining} day{daysRemaining === 1 ? "" : "s"} left</strong>
      <div className="usageMeter" aria-label="Trial usage meter">
        <div className="usageMeterTrack">
          <div className="usageMeterFill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <p className="muted small">
        {quotesRemaining} / {quoteCap} quotes remaining
      </p>
    </section>
  );
}
