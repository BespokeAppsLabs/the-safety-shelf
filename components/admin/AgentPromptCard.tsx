"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { api } from "@/convex/_generated/api";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/agentPrompt";

export function AgentPromptCard() {
  const { isAuthenticated } = useConvexAuth();
  const active = useQuery(api.agentPrompts.getActive, isAuthenticated ? {} : "skip");
  const history = useQuery(api.agentPrompts.list, isAuthenticated ? {} : "skip");
  const publish = useMutation(api.agentPrompts.create);
  const activate = useMutation(api.agentPrompts.activate);

  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the draft once the active version loads — never overwrite what
  // the owner is mid-editing.
  useEffect(() => {
    if (active !== undefined) setContent((current) => current || active?.content || DEFAULT_SYSTEM_PROMPT);
  }, [active]);

  // No active version yet ⇒ always publishable (first save adopts whatever
  // is in the box, even if it's the untouched default).
  const dirty = active ? content !== active.content : content.trim().length > 0;

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      await publish({ content, note: note.trim() || undefined });
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Agent context — system prompt</p>
        {active ? <Badge variant="success">v{active.version}</Badge> : <Badge variant="warning">Using built-in default</Badge>}
      </div>
      <p className="mt-2 text-sm text-muted">
        Sent at the start of every chat session, along with a live catalog snapshot. Publishing never
        overwrites history — it adds the next version and you can revert anytime.
      </p>

      <Textarea
        className="mt-4 min-h-64 font-mono text-xs"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Note for this version (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="max-w-sm"
        />
        <Button disabled={!dirty || busy} onClick={() => void handlePublish()}>
          {busy ? "Publishing…" : "Publish new version"}
        </Button>
        <button
          className="text-sm font-semibold text-primary"
          onClick={() => setShowHistory((current) => !current)}
        >
          {showHistory ? "Hide history" : `History${history ? ` (${history.length})` : ""}`}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm font-semibold text-red-strong">{error}</p> : null}

      {showHistory && history ? (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {history.map((row) => (
            <div key={row._id} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  v{row.version} {row.isActive ? <span className="text-primary">(active)</span> : null}
                </p>
                {row.note ? <p className="truncate text-xs text-muted">{row.note}</p> : null}
              </div>
              {!row.isActive ? (
                <Button size="sm" variant="ghost" onClick={() => void activate({ promptId: row._id })}>
                  Revert to this
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
