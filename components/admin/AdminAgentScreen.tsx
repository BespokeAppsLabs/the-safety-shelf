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
import { AGENT_RUN_TIMEOUT_MS, isAgentRunActive } from "@/lib/agentRun";

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

// A tool that threw. The model is told to own its failures, but it is the thing
// that failed — it cannot be the only witness. Shown whether or not the reply
// admits to it, so "the web search quietly stopped working" is visible here
// rather than inferred from answers that got vaguer.
function ToolFailures({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <div className="mt-1 space-y-1">
      {errors.map((detail, index) => (
        <p key={index} className="text-[11px] font-semibold text-red-strong">
          ⚠ {detail}
        </p>
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
  const recentActions = useQuery(api.agentActions.recent, isAuthenticated ? {} : "skip");
  const sendMessage = useAction(api.agent.sendMessage);
  const startTurn = useMutation(api.agentChats.startTurn);
  const cancelRun = useMutation(api.agentRuns.cancel);

  const [draft, setDraft] = useState("");
  // Only covers the gap between hitting send and startTurn returning. Once the
  // session exists, "is it working?" is answered by the session row itself, so
  // it survives navigation instead of living in this component.
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const runId = isAgentRunActive(chat?.runId, chat?.runStartedAt, now) ? chat!.runId! : null;
  const sending = starting || Boolean(runId);

  // A crashed action cannot clear its row. Wake this component when the same
  // ten-minute lease used by startTurn expires so the owner can send again
  // without waiting for some unrelated reactive update.
  useEffect(() => {
    if (!chat?.runId || !chat.runStartedAt) return;
    const remaining = AGENT_RUN_TIMEOUT_MS - (Date.now() - chat.runStartedAt);
    if (remaining <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = window.setTimeout(() => setNow(Date.now()), remaining + 25);
    return () => window.clearTimeout(timer);
  }, [chat?.runId, chat?.runStartedAt]);

  // Hand `starting` over to the session's own running flag only once the
  // session has actually loaded. Clearing it in send() would unlock the input
  // for the frame between the mutation resolving and the query catching up,
  // which is long enough to fire a second message into a busy session.
  useEffect(() => {
    if (chat && chat._id === activeChatId) setStarting(false);
  }, [chat, activeChatId]);

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
  //
  // The runId comes off the session row, so this also stops a run started
  // before a reload or on another screen — the thing you reopened to check on.
  useEffect(() => {
    if (!runId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void cancelRun({ runId });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runId, cancelRun]);

  const messages = (chat?.messages ?? []) as {
    role: "user" | "assistant";
    content: string;
    cards?: AgentCard[];
    tools?: string[];
    toolErrors?: string[];
    stopped?: boolean;
  }[];

  // Progress for translations THIS conversation asked for.
  //
  // agentActions.recent is owner-wide, so filtering it on status alone put the
  // banner in every session — including a brand new one that had asked for
  // nothing. A proposal belongs to the thread holding its card, and that
  // relationship is already recorded there: the card carries the actionId.
  // Read it back rather than inventing a second source of truth.
  const proposalIds = new Set(
    messages.flatMap((message) =>
      (message.cards ?? [])
        .map((card) => (card.props as { actionId?: string } | undefined)?.actionId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const runningTranslations = (recentActions ?? []).filter(
    (item) => item.tool === "translateBook" && item.status === "approved" && proposalIds.has(item._id),
  );

  // The conversation is a live feed: every new turn or chat selection lands at
  // the bottom so the newest message is immediately visible.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeChatId, messages.length, sending, runningTranslations.length]);

  // Two steps, deliberately: open the turn (which creates the session and
  // stores the message), then run the agent against it. The session is durable
  // from the first step, so nothing here needs to survive — navigating away
  // mid-run loses no more than the scroll position, and the reply is committed
  // server-side into a thread that is already in History.
  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft("");
    setStarting(true);
    setError(null);
    const turnRunId = crypto.randomUUID();

    try {
      const id = await startTurn({ chatId: activeChatId ?? undefined, content: text, runId: turnRunId });
      if (id !== activeChatId) onChatStarted(id as Id<"agentChats">);
      // Deliberately not awaited: durable completion arrives through the live
      // thread. A dispatch/auth rejection still needs to be visible locally;
      // the ten-minute lease is the backstop when no authenticated path settles.
      void sendMessage({ message: text, chatId: id, runId: turnRunId }).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
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
        {messages.length === 0 ? (
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
              {msg.role === "assistant" ? <ToolFailures errors={msg.toolErrors} /> : null}
              {msg.cards?.length ? <CardList cards={msg.cards} /> : null}
            </div>
          ))
        )}
        {sending ? <p className="text-sm italic text-muted">Thinking… <span className="not-italic">(Esc to stop)</span></p> : null}
        {runningTranslations.map((item) => {
          const args = item.args as { title?: string; language?: string } | undefined;
          return (
            <div key={item._id} className="flex items-start gap-2 rounded-2xl bg-white p-3 shadow-soft">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              <p className="text-sm text-ink">
                <span className="font-semibold">Translating {args?.title ? `“${args.title}”` : "your book"}</span>
                {args?.language ? ` into ${args.language}` : ""} — started {relativeTime(item.decidedAt ?? item.proposedAt)}.
                <span className="block text-xs text-muted">
                  A chapter at a time; this takes a few minutes. A review card appears here when it lands — you can leave
                  this page.
                </span>
              </p>
            </div>
          );
        })}
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
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    {item.busy ? (
                      <>
                        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                        <span className="font-semibold text-primary">Working…</span>
                        <span aria-hidden="true">·</span>
                      </>
                    ) : null}
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
