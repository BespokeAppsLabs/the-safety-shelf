"use client";

import { useState } from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api } from "@/convex/_generated/api";
import { IMAGE_PROVIDERS } from "@/lib/imageModels";

const TEXT_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "kimi", label: "Kimi (Moonshot)" },
  { value: "glm", label: "GLM (Zhipu)" },
] as const;

function StatusLine({ title, status }: { title: string; status: { provider: string; model?: string; keyLast4?: string; isActive: boolean } | null | undefined }) {
  return (
    <div className="rounded-3xl bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {status?.isActive ? <Badge variant="success">Connected</Badge> : <Badge variant="warning">Not connected</Badge>}
      </div>
      <p className="mt-2 text-sm text-muted">
        {status ? `${status.provider} · ${status.model ?? "model selected at use"}${status.keyLast4 ? ` · key ending ${status.keyLast4}` : ""}` : "No key connected."}
      </p>
    </div>
  );
}

export function AdminSettingsScreen() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const status = useQuery(api.aiCredentials.getStatus, isAuthenticated ? {} : "skip");
  const setKey = useAction(api.aiCredentials.actions.setKey.setKey);
  const testImageProvider = useAction(api.aiCredentials.actions.testImageProvider.testImageProvider);
  const startHiggsfieldOAuth = useAction(api.higgsfieldOAuth.start);
  const listHiggsfieldTools = useAction(api.higgsfieldMcp.listTools);

  const [textProvider, setTextProvider] = useState<(typeof TEXT_PROVIDERS)[number]["value"]>("openai");
  const [imageProvider, setImageProvider] = useState<(typeof IMAGE_PROVIDERS)[number]["value"]>("openai");
  const [textKey, setTextKey] = useState("");
  const [imageKey, setImageKey] = useState("");
  const [busy, setBusy] = useState<"text" | "image" | "ollama" | "test" | "tools" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [higgsfieldTools, setHiggsfieldTools] = useState<Array<{ name: string; description?: string; inputSchemaJson: string }> | null>(null);

  async function connectText() {
    setBusy("text");
    setError(null);
    try {
      await setKey({ purpose: "text", provider: textProvider, apiKey: textKey });
      setTextKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function connectHiggsfield() {
    setBusy("image");
    setError(null);
    setTestResult(null);
    try {
      const redirectUri = `${window.location.origin}/api/higgsfield/oauth/callback`;
      const { authorizationUrl } = await startHiggsfieldOAuth({ redirectUri });
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  async function connectImage() {
    setBusy("image");
    setError(null);
    setTestResult(null);
    try {
      if (imageProvider === "higgsfield") return await connectHiggsfield();
      await setKey({ purpose: "image", provider: imageProvider, apiKey: imageKey });
      setImageKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function runImageProviderTest() {
    setBusy("test");
    setError(null);
    setTestResult(null);
    try {
      const result = await testImageProvider({});
      setTestResult(`${result.ok ? "PASS" : "CHECK"}: ${result.message}${result.status ? ` (HTTP ${result.status})` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function inspectHiggsfieldTools() {
    setBusy("tools");
    setError(null);
    setTestResult(null);
    try {
      const result = await listHiggsfieldTools({});
      setHiggsfieldTools(result.tools);
      setTestResult(`PASS: Higgsfield MCP exposed ${result.tools.length} tools to the app runtime.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function connectOllama() {
    setBusy("ollama");
    setError(null);
    try {
      await setKey({ purpose: "text", provider: "ollama" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (authLoading) return null;
  if (!isAuthenticated) return <Card><p className="text-sm font-semibold text-ink">Sign in as the owner to manage providers.</p></Card>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">AI providers</h1>
        <p className="mt-3 text-base text-muted">Text and image generation use separate BYOK keys. Same vendor is allowed, same key is not assumed.</p>
      </div>

      <Card className="grid gap-4 md:grid-cols-2">
        <StatusLine title="Text generation key" status={status?.text} />
        <StatusLine title="Image generation key" status={status?.image} />
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">Text provider — local Ollama</p>
        <p className="mt-2 text-sm text-muted">Offline text only. Image generation still needs a separate image provider key.</p>
        <div className="mt-4"><Button variant="secondary" disabled={busy !== null} onClick={connectOllama}>{busy === "ollama" ? "Connecting…" : "Connect text to local Ollama"}</Button></div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">Text provider key</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TEXT_PROVIDERS.map((option) => (
            <button key={option.value} onClick={() => setTextProvider(option.value)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${textProvider === option.value ? "bg-primary text-white" : "bg-white text-muted hover:bg-background hover:text-ink"}`}>{option.label}</button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Input type="password" placeholder="Paste text API key" value={textKey} onChange={(event) => setTextKey(event.target.value)} className="max-w-sm" />
          <Button disabled={busy !== null || textKey.trim().length < 8} onClick={connectText}>{busy === "text" ? "Validating…" : "Save text key"}</Button>
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">Image provider key</p>
        <p className="mt-2 text-sm text-muted">Used only for cover/page image generation. Model and estimated cost are selected at generation time. Higgsfield uses MCP auth, not an API key.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {IMAGE_PROVIDERS.map((option) => (
            <button key={option.value} onClick={() => setImageProvider(option.value)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${imageProvider === option.value ? "bg-primary text-white" : "bg-white text-muted hover:bg-background hover:text-ink"}`}>{option.label}</button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {imageProvider === "higgsfield" ? (
            <p className="rounded-full bg-background px-4 py-3 text-sm text-muted">No API key — sign in to Higgsfield and the app stores MCP OAuth tokens in Convex.</p>
          ) : (
            <Input type="password" placeholder="Paste image API key" value={imageKey} onChange={(event) => setImageKey(event.target.value)} className="max-w-sm" />
          )}
          <Button disabled={busy !== null || (imageProvider !== "higgsfield" && imageKey.trim().length < 8)} onClick={connectImage}>
            {busy === "image" ? "Connecting…" : imageProvider === "higgsfield" ? "Login to Higgsfield MCP" : "Save image key"}
          </Button>
          <Button variant="ghost" disabled={busy !== null || !status?.image} onClick={runImageProviderTest}>
            {busy === "test" ? "Testing…" : "Test image provider"}
          </Button>
          <Button variant="ghost" disabled={busy !== null || status?.image?.provider !== "higgsfield"} onClick={inspectHiggsfieldTools}>
            {busy === "tools" ? "Inspecting…" : "Inspect Higgsfield tools"}
          </Button>
        </div>
        {testResult ? <p className="mt-3 text-sm font-semibold text-ink">{testResult}</p> : null}
        {higgsfieldTools ? (
          <div className="mt-4 max-h-96 space-y-3 overflow-auto rounded-3xl bg-background p-4">
            {higgsfieldTools.map((tool) => (
              <details key={tool.name} className="rounded-2xl bg-white p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink">{tool.name}</summary>
                {tool.description ? <p className="mt-2 text-xs text-muted">{tool.description}</p> : null}
                <pre className="mt-2 overflow-auto rounded-2xl bg-background p-3 text-[11px] text-muted">{tool.inputSchemaJson}</pre>
              </details>
            ))}
          </div>
        ) : null}
      </Card>

      {error ? <Card className="border-red-soft bg-red-soft/40"><p className="text-sm font-semibold text-red-strong">{error}</p></Card> : null}
    </div>
  );
}
