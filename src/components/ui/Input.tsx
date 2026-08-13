import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "./utils";

type InputVariant = "boxed" | "underline";

type SharedProps = {
  variant?: InputVariant;
  className?: string;
};

export function Input({
  variant = "boxed",
  className,
  ...props
}: SharedProps & InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("uiInput", variant, className)} {...props} />;
}

export function Textarea({
  variant = "boxed",
  className,
  ...props
}: SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("uiInput", variant, className)} {...props} />;
}

export function Select({
  variant = "boxed",
  className,
  ...props
}: SharedProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("uiInput", variant, className)} {...props} />;
}

