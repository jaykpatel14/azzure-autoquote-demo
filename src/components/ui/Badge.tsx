import type { HTMLAttributes } from "react";
import { cn } from "./utils";

type BadgeVariant = "draft" | "sent" | "ordered" | "expired" | "neutral";

export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn("badge", variant, className)} {...props} />;
}

