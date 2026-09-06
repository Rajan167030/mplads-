"use client";

import type { AssistantConversationSummary } from "@/lib/api";

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: AssistantConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-dashboard-line bg-white">
      <div className="border-b border-dashboard-line p-3">
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-lg bg-dashboard-navy px-3 py-2 text-sm font-semibold text-white hover:bg-dashboard-deep"
        >
          + New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 && (
          <p className="p-3 text-xs text-dashboard-muted">No conversations yet — start one above.</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group mb-1 flex items-center gap-1 rounded-lg px-2 py-2 text-left text-xs ${
              c.id === activeId ? "bg-dashboard-blue-soft font-semibold text-dashboard-navy" : "hover:bg-dashboard-surface"
            }`}
          >
            <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate text-left">
              {c.document_filename && <span className="mr-1">📎</span>}
              {c.title}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              title="Delete conversation"
              className="shrink-0 rounded px-1 text-dashboard-muted opacity-0 hover:text-dashboard-red group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
