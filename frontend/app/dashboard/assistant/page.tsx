"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ConversationSidebar } from "@/components/assistant/conversation-sidebar";
import { MarkdownLite } from "@/components/assistant/markdown-lite";
import { MicButton } from "@/components/assistant/mic-button";
import { SpeakButton } from "@/components/assistant/speak-button";
import {
  ApiError,
  createConversation,
  deleteConversation,
  getAssistantStatus,
  getConversation,
  listConversations,
  sendConversationMessage,
  uploadConversationDocument,
  type AssistantConversationDetail,
  type AssistantConversationSummary,
  type AssistantMessageOut,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function AssistantPage() {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<{ configured: boolean; provider: string } | null>(null);
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [active, setActive] = useState<AssistantConversationDetail | null>(null);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAssistantStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  async function refreshConversations() {
    if (!token) return;
    try {
      setConversations(await listConversations(token));
    } catch {
      // sidebar list is secondary — a failed refresh shouldn't block the chat itself
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  async function handleSelect(id: string) {
    if (!token) return;
    setError(null);
    try {
      setActive(await getConversation(token, id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load conversation.");
    }
  }

  async function handleNew() {
    if (!token) return;
    setError(null);
    try {
      const created = await createConversation(token);
      await refreshConversations();
      setActive({ ...created, messages: [] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create conversation.");
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await deleteConversation(token, id);
      if (active?.id === id) setActive(null);
      await refreshConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete conversation.");
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !question.trim()) return;

    let conversation = active;
    if (!conversation) {
      try {
        const created = await createConversation(token);
        conversation = { ...created, messages: [] };
        setActive(conversation);
        await refreshConversations();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not start a conversation.");
        return;
      }
    }

    const questionText = question.trim();
    setQuestion("");
    setSending(true);
    setError(null);

    // Optimistic append so the question shows immediately, not after the round-trip.
    const optimisticUser: AssistantMessageOut = {
      id: `pending-${Date.now()}`,
      role: "USER",
      content: questionText,
      grounded_on: null,
      created_at: new Date().toISOString(),
    };
    setActive((prev) => (prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev));

    try {
      const result = await sendConversationMessage(token, conversation.id, questionText);
      setActive((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages.filter((m) => m.id !== optimisticUser.id), result.user_message, result.assistant_message],
            }
          : prev
      );
      refreshConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the assistant.");
      setActive((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticUser.id) } : prev));
    } finally {
      setSending(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;

    let conversation = active;
    if (!conversation) {
      try {
        const created = await createConversation(token);
        conversation = { ...created, messages: [] };
        setActive(conversation);
        await refreshConversations();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not start a conversation.");
        return;
      }
    }

    setUploading(true);
    setError(null);
    try {
      await uploadConversationDocument(token, conversation.id, file);
      setActive((prev) => (prev ? { ...prev, document_filename: file.name } : prev));
      await refreshConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not upload document.");
    } finally {
      setUploading(false);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-dashboard-surface px-4">
        <div className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-800">
          <Link href="/" className="font-semibold underline">
            Sign in
          </Link>{" "}
          to use the AI Assistant — conversation history and document uploads are tied to your account.
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-dashboard-surface">
      <ConversationSidebar
        conversations={conversations}
        activeId={active?.id ?? null}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-dashboard-line bg-white px-3 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversation list"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-dashboard-line text-dashboard-ink lg:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold">AI Assistant</h1>
            <p className="truncate text-xs text-dashboard-muted">
              Grounded in real data — never answers from outside knowledge about a specific project.
              {active?.document_filename && (
                <span className="ml-2 rounded bg-dashboard-blue-soft px-1.5 py-0.5 font-semibold text-dashboard-navy">
                  📎 {active.document_filename}
                </span>
              )}
            </p>
          </div>
        </div>

        {status && !status.configured && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
            No LLM provider is configured — questions will still retrieve real data but won&apos;t get a narrated answer.
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!active && (
            <div className="flex h-full items-center justify-center text-sm text-dashboard-muted">
              Start a new chat, or ask a question below to begin one.
            </div>
          )}
          {active?.messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-dashboard-muted">
              Ask about the portfolio overall, a specific project, or upload a document to ask about it.
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-4">
            {active?.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    m.role === "USER" ? "bg-dashboard-navy text-white" : "bg-white text-dashboard-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap">
                    <MarkdownLite text={m.content} />
                  </p>
                  {m.role === "ASSISTANT" && (
                    <div className="mt-1.5 border-t border-dashboard-line pt-1.5">
                      <SpeakButton text={m.content} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {error && <div className="mx-5 mb-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSend} className="border-t border-dashboard-line bg-white p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach a document (PDF/TXT/MD) to ground answers on"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-dashboard-line text-dashboard-muted hover:bg-dashboard-surface disabled:opacity-50"
            >
              {uploading ? "…" : "📎"}
            </button>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              rows={1}
              placeholder="Ask about the portfolio, a project, or your uploaded document…"
              className="max-h-32 flex-1 resize-none rounded-2xl border border-dashboard-line px-4 py-2 text-sm outline-none focus:border-dashboard-navy"
            />
            <MicButton
              onTranscript={(text) => setQuestion((prev) => (prev ? `${prev} ${text}` : text))}
              onError={setError}
            />
            <button
              type="submit"
              disabled={sending || !question.trim()}
              className="shrink-0 rounded-full bg-dashboard-navy px-4 py-2 text-sm font-semibold text-white hover:bg-dashboard-deep disabled:opacity-50"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
