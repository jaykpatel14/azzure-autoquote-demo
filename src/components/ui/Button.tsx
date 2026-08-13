import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import { cn } from "./utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "button--sm",
  md: "button--md",
  lg: "button--lg"
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "destructive"
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("button", variantClasses[variant], sizeClasses[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={cn("button", variantClasses[variant], sizeClasses[size], className)} {...props} />;
}

