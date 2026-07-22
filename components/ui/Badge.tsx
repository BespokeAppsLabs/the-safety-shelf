import type { ReactNode } from "react";

const variants = {
  neutral: "bg-background text-muted",
  success: "bg-mint text-primary",
  warning: "bg-amber-soft text-amber-strong",
  info: "bg-blue-soft text-blue-strong",
  danger: "bg-red-soft text-red-strong",
} as const;

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}
