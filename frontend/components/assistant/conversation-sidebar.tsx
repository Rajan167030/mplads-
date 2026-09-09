"use client";

import { X } from "lucide-react";

import type { AssistantConversationSummary } from "@/lib/api";

export function ConversationSidebar({
  conversations,
  activeId,
  open,
  onClose,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: AssistantConversationSummary[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-dashboard-line bg-white transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center gap-2 border-b border-dashboard-line p-3">
          <button
            type="button"
            onClick={onNew}
            className="flex-1 rounded-lg bg-dashboard-navy px-3 py-2 text-sm font-semibold text-white hover:bg-dashboard-deep"
          >
            + New Chat
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation list"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-dashboard-muted hover:bg-dashboard-surface lg:hidden"
          >
            <X size={18} />
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
              <button
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  onClose();
                }}
                className="min-w-0 flex-1 truncate text-left"
              >
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
                className="shrink-0 rounded px-1 text-dashboard-muted/60 hover:text-dashboard-red"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
