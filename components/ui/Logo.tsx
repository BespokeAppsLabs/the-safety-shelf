type LogoProps = { className?: string };

export function Logo({ className = "h-8 w-8" }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2 4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3Z"
        className="fill-mint stroke-primary"
        strokeWidth="1.5"
      />
      <rect x="8.5" y="8" width="2.2" height="8" rx="0.6" className="fill-primary" />
      <rect x="11.4" y="8" width="2.2" height="8" rx="0.6" className="fill-amber" />
      <rect x="14.3" y="8" width="2.2" height="8" rx="0.6" className="fill-primary" />
    </svg>
  );
}
