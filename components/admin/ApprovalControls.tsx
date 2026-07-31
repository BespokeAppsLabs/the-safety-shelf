"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Propose-then-confirm controls shared by every write-tool card. Subscribes to
// the proposal so Approve/Reject in one card reflects immediately; Approve runs
// the write server-side (agentActions.approveAndExecute), Reject just records
// the verdict. Buttons vanish once the proposal leaves "proposed".
export function ApprovalControls({ actionId }: { actionId: string }) {
  const id = actionId as Id<"agentActions">;
  const action = useQuery(api.agentActions.get, { actionId: id });
  const approve = useMutation(api.agentActions.approveAndExecute);
  const reject = useMutation(api.agentActions.decide);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = action?.status ?? "proposed";
  if (status !== "proposed") {
    const variant = status === "executed" ? "success" : status === "rejected" ? "neutral" : "danger";
    const label = status === "executed" ? "Approved & applied" : status === "rejected" ? "Rejected" : "Failed";
    return (
      <div className="mt-4">
        <Badge variant={variant}>{label}</Badge>
      </div>
    );
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void run(() => approve({ actionId: id }))}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void run(() => reject({ actionId: id, decision: "rejected" }))}
        >
          Reject
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-red-strong">{error}</p> : null}
    </div>
  );
}
