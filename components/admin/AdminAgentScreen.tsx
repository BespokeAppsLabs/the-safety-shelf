"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { AGENT_COMPONENTS } from "@/components/admin/AgentCards";
import { AgentPromptCard } from "@/components/admin/AgentPromptCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type AgentCard = { component: string; props: Record<string, unknown> };

function relativeTime(ms: number) {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Rejects when the signal aborts — raced against the in-flight request so Esc
// can bail out of waiting for a reply that can't be server-cancelled.
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

// What the turn actually DID, not what it said it would do.
//
// The agent's characteristic failure is narrating an action instead of calling
// the tool — "let me create a draft…" followed by nothing. Prose alone cannot
// be distinguished from real work, so every assistant turn now states its
// tools, including when there were none.
function ToolTrace({ tools }: { tools?: string[] }) {
  // Undefined means "not recorded" — every turn from before this was tracked.
  // Rendering those as "no tools used" would assert something false about
  // history, since plenty of them did call tools. Absent data stays silent.
  if (!tools) return null;
  if (!tools.length) {
    return <p className="mt-1 text-[11px] text-muted">No tools used — nothing was created or changed.</p>;
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <span className="text-[11px] text-muted">Used</span>
      {tools.map((name) => (
        <span key={name} className="rounded-full bg-background px-2 py-0.5 font-mono text-[11px] text-ink">
          {name}
        </span>
      ))}
    </div>
  );
}

function CardList({ cards }: { cards: AgentCard[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-start gap-3">
      {cards.map((card, index) => {
        const Component = AGENT_COMPONENTS[card.component];
        return Component ? <Component key={index} {...card.props} /> : null;
      })}
    </div>
  );
}

function ChatPanel({
  activeChatId,
  onChatStarted,
}: {
  activeChatId: Id<"agentChats"> | null;
  onChatStarted: (id: Id<"agentChats">) => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(api.aiCredentials.getStatus, isAuthenticated ? {} : "skip");
  const chat = useQuery(api.agentChats.get, activeChatId ? { chatId: activeChatId } : "skip");
  const sendMessage = useAction(api.agent.sendMessage);
  const appendTurn = useMutation(api.agentChats.appendTurn);
  const cancelRun = useMutation(api.agentRuns.cancel);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);

  // Auto-grow the input: reset to one line, then expand to fit content up to a
  // cap (past which it scrolls). Runs on every draft change, so clearing after
  // send snaps it back to a single line.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  // Esc stops the running request. Global (not just the textarea) so it works
  // even if focus moved while the agent was thinking. Single press — matches
  // the "stop generating" convention; nothing else here needs Esc.
  useEffect(() => {
    if (!sending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        abortRef.current?.abort(); // stop the client's wait immediately…
        if (runIdRef.current) void cancelRun({ runId: runIdRef.current }); // …and abort generation server-side
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sending]);

  const messages = (chat?.messages ?? []) as {
    role: "user" | "assistant";
    content: string;
    cards?: AgentCard[];
    tools?: string[];
    stopped?: boolean;
  }[];

  // The conversation is a live feed: every new turn, pending echo, or chat
  // selection lands at the bottom so the newest message is immediately visible.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeChatId, messages.length, pending, sending]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft("");
    setPending(text);
    setSending(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const runId = crypto.randomUUID();
    runIdRef.current = runId;
    const request = sendMessage({ message: text, chatId: activeChatId ?? undefined, runId });
    request.catch(() => {}); // server aborts on cancel; swallow its late rejection since we raced past it

    try {
      const { reply, cards, tools, modelMessages } = await Promise.race([request, rejectOnAbort(controller.signal)]);
      const chatId = await appendTurn({
        chatId: activeChatId ?? undefined,
        userContent: text,
        assistantContent: reply,
        cards: (cards.length ? cards : undefined) as AgentCard[] | undefined,
        // Sent even when empty: [] means "ran nothing", which is precisely the
        // narration failure worth showing. Only undefined means "unrecorded".
        tools,
        modelMessages: modelMessages?.length ? modelMessages : undefined,
      });
      if (chatId !== activeChatId) onChatStarted(chatId as Id<"agentChats">);
    } catch (err) {
      if (controller.signal.aborted) {
        // Record the stop for the human-facing thread only. `stopped: true`
        // keeps it out of the model's history (getForOwner), so the agent
        // won't try to resume the request the owner cut off. Reply discarded.
        const chatId = await appendTurn({
          chatId: activeChatId ?? undefined,
          userContent: text,
          assistantContent: "⏹ Stopped by the user before this response finished.",
          stopped: true,
        });
        if (chatId !== activeChatId) onChatStarted(chatId as Id<"agentChats">);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSending(false);
      setPending(null);
      abortRef.current = null;
      runIdRef.current = null;
    }
  }

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Live session</p>
        {status?.openrouter ? (
          <Badge variant="success">OpenRouter · connected</Badge>
        ) : (
          <Badge variant="warning">No OpenRouter key connected</Badge>
        )}
      </div>

      <div ref={messagesRef} className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-3xl bg-background p-4">
        {messages.length === 0 && !pending ? (
          <p className="text-sm text-muted">
            Ask about sales, top sellers, or revenue — or say &ldquo;take me to the catalog&rdquo; and the agent will
            navigate the app for you.
          </p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={msg.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  msg.stopped
                    ? "bg-transparent italic text-muted"
                    : msg.role === "user"
                      ? "bg-primary text-white"
                  : "whitespace-pre-wrap break-words leading-6 bg-white text-ink shadow-soft"
                }`}
              >
                {msg.content}
              </span>
              {msg.role === "assistant" && !msg.stopped ? <ToolTrace tools={msg.tools} /> : null}
              {msg.cards?.length ? <CardList cards={msg.cards} /> : null}
            </div>
          ))
        )}
        {pending ? (
          <div className="text-right">
            <span className="inline-block max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-white">{pending}</span>
          </div>
        ) : null}
        {sending ? <p className="text-sm italic text-muted">Thinking… <span className="not-italic">(Esc to stop)</span></p> : null}
      </div>

      <div className="mt-4 flex shrink-0 items-end gap-2 rounded-3xl border border-border bg-white p-1.5 transition focus-within:border-primary">
        <textarea
          ref={inputRef}
          rows={1}
          className="max-h-40 min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-muted disabled:opacity-60"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Message the agent…"
          disabled={!status}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!status || sending || !draft.trim()}
          aria-label="Send message"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </div>
      {!status ? (
        <p className="mt-2 text-sm text-muted">Connect a provider in Settings before testing chat.</p>
      ) : null}
      {error ? <p className="mt-2 text-sm font-semibold text-red-strong">{error}</p> : null}
    </Card>
  );
}

function HistoryRail({
  activeChatId,
  onSelect,
  onNewChat,
  onManageContext,
}: {
  activeChatId: Id<"agentChats"> | null;
  onSelect: (id: Id<"agentChats">) => void;
  onNewChat: () => void;
  onManageContext: () => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const chats = useQuery(api.agentChats.list, isAuthenticated ? {} : "skip");
  const removeChat = useMutation(api.agentChats.remove);

  async function handleDelete(id: Id<"agentChats">) {
    await removeChat({ chatId: id });
    if (id === activeChatId) onNewChat(); // was open — drop back to a fresh session
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card className="shrink-0">
        <p className="text-sm font-semibold text-ink">Agent context</p>
        <p className="mt-1 text-sm text-muted">System prompt and the catalog snapshot sent at the start of every session.</p>
        <Button className="mt-4 w-full" variant="ghost" onClick={onManageContext}>
          Manage context
        </Button>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">History</p>
          <Button size="sm" onClick={onNewChat}>New chat</Button>
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {chats === undefined ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : chats.length === 0 ? (
            <p className="text-sm text-muted">No past chats yet.</p>
          ) : (
            chats.map((item) => (
              <div
                key={item._id}
                className={`group flex items-center gap-2 rounded-2xl pr-2 transition ${
                  item._id === activeChatId ? "bg-mint" : "bg-background hover:bg-mint/60"
                }`}
              >
                <button onClick={() => onSelect(item._id)} className="min-w-0 flex-1 px-4 py-3 text-left">
                  <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.messageCount} message{item.messageCount === 1 ? "" : "s"} · {relativeTime(item.updatedAt)}
                  </p>
                </button>
                <button
                  onClick={() => void handleDelete(item._id)}
                  aria-label="Delete conversation"
                  className="shrink-0 rounded-full p-2 text-muted opacity-0 transition hover:bg-white hover:text-red-strong focus:opacity-100 group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

export function AdminAgentScreen() {
  const [activeChatId, setActiveChatId] = useState<Id<"agentChats"> | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <div className="shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Agent workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Chat with the store agent.</h1>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[1fr_22rem]">
        <ChatPanel activeChatId={activeChatId} onChatStarted={setActiveChatId} />
        <HistoryRail
          activeChatId={activeChatId}
          onSelect={setActiveChatId}
          onNewChat={() => setActiveChatId(null)}
          onManageContext={() => setContextOpen(true)}
        />
      </div>

      <Dialog open={contextOpen} onClose={() => setContextOpen(false)}>
        <AgentPromptCard />
      </Dialog>
    </div>
  );
}
