"use client";

import { useState } from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api } from "@/convex/_generated/api";

export function AdminSettingsScreen() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const status = useQuery(api.aiCredentials.getStatus, isAuthenticated ? {} : "skip");
  const setKey = useAction(api.aiCredentials.actions.setKey.setKey);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await setKey({ apiKey });
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;
  if (!isAuthenticated) return <Card><p className="text-sm font-semibold text-ink">Sign in as the owner to manage AI.</p></Card>;

  const connected = status?.openrouter;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">OpenRouter AI</h1>
        <p className="mt-3 text-base text-muted">One encrypted key powers chat, translations, social copy, and images. ElevenLabs remains separate.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Connection</p>
          {connected?.isActive ? <Badge variant="success">Connected</Badge> : <Badge variant="warning">Not connected</Badge>}
        </div>
        <p className="mt-2 text-sm text-muted">
          {connected ? `OpenRouter · key ending ${connected.keyLast4} · validated with free routing` : "Paste an OpenRouter API key to connect AI."}
        </p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">OpenRouter API key</p>
        <p className="mt-2 text-sm text-muted">Saving verifies the key without running a model, then encrypts it before storage.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Input type="password" placeholder="Paste OpenRouter API key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="max-w-sm" />
          <Button disabled={busy || apiKey.trim().length < 8} onClick={save}>{busy ? "Validating…" : "Save key"}</Button>
        </div>
      </Card>

      {error ? <Card className="border-red-soft bg-red-soft/40"><p className="text-sm font-semibold text-red-strong">{error}</p></Card> : null}
    </div>
  );
}
