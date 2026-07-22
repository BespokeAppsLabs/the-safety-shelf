import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      {...props}
      className={`rounded-card border border-border bg-surface p-6 shadow-soft ${className}`.trim()}
    >
      {children}
    </div>
  );
}
