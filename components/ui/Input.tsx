import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...props}
      className={`w-full rounded-full border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary ${className}`.trim()}
    />
  );
}
