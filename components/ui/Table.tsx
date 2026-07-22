import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-soft">
      <table className="min-w-full divide-y divide-border text-left text-sm">
        {children}
      </table>
    </div>
  );
}
