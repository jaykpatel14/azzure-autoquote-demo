import type { HTMLAttributes } from "react";
import { cn } from "./utils";

type UsageBarProps = {
  used: number;
  total: number;
  label?: string;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export function UsageBar({ used, total, label, className, ...props }: UsageBarProps) {
  const progress = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;

  return (
    <div className={cn("usageMeter", className)} {...props}>
      {label ? <div className="muted small">{label}</div> : null}
      <div className="usageMeterTrack" aria-hidden="true">
        <div className="usageMeterFill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

