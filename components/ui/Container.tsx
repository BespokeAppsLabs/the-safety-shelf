import type { HTMLAttributes, ReactNode } from "react";

export function Container({
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
      className={`mx-auto w-full max-w-7xl px-4 sm:px-6 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
