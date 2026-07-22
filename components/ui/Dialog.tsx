"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Native <dialog> — gets focus trap, Esc-to-close, and an inert backdrop for
// free, so no focus-management or portal library. Backdrop clicks close it
// (a click whose target is the dialog element itself landed on the ::backdrop).
export function Dialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-full max-w-2xl bg-transparent p-4 backdrop:bg-ink/50"
    >
      {open ? <div className="max-h-[85vh] overflow-y-auto">{children}</div> : null}
    </dialog>
  );
}
