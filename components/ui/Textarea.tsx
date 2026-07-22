import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return (
    <textarea
      {...props}
      className={`min-h-32 w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary ${className}`.trim()}
    />
  );
}
