import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-strong",
  secondary: "bg-amber text-amber-ink hover:bg-amber-strong",
  ghost: "bg-transparent text-ink hover:bg-background",
  danger: "bg-red text-white hover:bg-red-strong",
} as const;

const sizes = {
  md: "px-5 py-3 text-sm",
  sm: "px-4 py-2 text-sm",
} as const;

export function Button({
  children,
  className = "",
  size = "md",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
  size?: keyof typeof sizes;
  variant?: keyof typeof variants;
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
