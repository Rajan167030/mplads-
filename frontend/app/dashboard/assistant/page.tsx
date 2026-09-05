"use client";

import { useEffect, useState } from "react";

import { ApiError, getAssistantStatus, queryAssistant, type AssistantResponse } from "@/lib/api";

export default function AssistantPage() {
  const [status, setStatus] = useState<{ configured: boolean; provider: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [projectId, setProjectId] = useState("");
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssistantStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await queryAssistant(question, projectId.trim() || undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">AI Assistant</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          Ask about the portfolio overall, or paste a project ID to ask about a specific one. Every answer is grounded
          in real data retrieved from the database first — the assistant never answers from outside knowledge.
        </p>

        {status && !status.configured && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No LLM provider is configured (<code className="font-mono">LLM_PROVIDER=none</code>). Questions will still
            retrieve and show the real underlying data, but won&apos;t get a narrated answer until an LLM key is set.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3 rounded-lg bg-white p-5 shadow-sm">
          <label className="block text-xs font-semibold text-dashboard-ink">
            Project ID (optional — leave blank for a portfolio-wide question)
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g. 3ed22a06-612e-48c8-aa12-3e8a6ed37490"
              className="mt-1 w-full rounded border border-dashboard-line px-3 py-2 text-sm outline-none focus:border-dashboard-navy"
            />
          </label>
          <label className="block text-xs font-semibold text-dashboard-ink">
            Question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Why was this project flagged as high risk?"
              className="mt-1 w-full rounded border border-dashboard-line px-3 py-2 text-sm outline-none focus:border-dashboard-navy"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-dashboard-navy px-4 py-2 text-sm font-semibold text-white hover:bg-dashboard-deep disabled:opacity-60"
          >
            {loading ? "Retrieving…" : "Ask"}
          </button>
        </form>

        {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="mt-5 space-y-4">
            {result.answer ? (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">Answer</div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{result.answer}</p>
              </div>
            ) : (
              result.error && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{result.error}</div>
              )
            )}

            <div className="rounded-lg bg-white p-5 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                Retrieved context (what the answer is grounded on)
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-dashboard-surface p-3 text-xs text-dashboard-ink">
                {result.context_summary}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
