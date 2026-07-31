"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { ApprovalControls } from "@/components/admin/ApprovalControls";
import { ReviewProposalDialog } from "@/components/admin/ReviewProposalDialog";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Tools whose proposal carries something worth reading before approving.
const REVIEWABLE = new Set(["writeBook", "editBook", "publishBook"]);

// Approve/Reject plus, for proposals that change a book, a Review that opens
// the full draft. Lives with the controls rather than on one screen so every
// card showing a proposal — the agent chat and the approvals page — offers the
// same review before the owner commits to it.
export function ProposalActions({ actionId }: { actionId: string }) {
  const id = actionId as Id<"agentActions">;
  const action = useQuery(api.agentActions.get, { actionId: id });
  const [reviewing, setReviewing] = useState(false);

  const reviewable = action?.status === "proposed" && REVIEWABLE.has(action.tool);

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <ApprovalControls actionId={actionId} />
        {reviewable ? (
          <Button size="sm" variant="ghost" className="mt-4" onClick={() => setReviewing(true)}>
            Review
          </Button>
        ) : null}
      </div>
      {reviewing && action ? (
        <ReviewProposalDialog action={action} onClose={() => setReviewing(false)} />
      ) : null}
    </>
  );
}
