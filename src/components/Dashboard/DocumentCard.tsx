"use client";

import { useState } from "react";
import type { Category, DocumentItem } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/format";

function iconFor(mimeType: string) {
  if (mimeType === "application/pdf") return "📕";
  if (mimeType.startsWith("image/")) return "🖼️";
  return "📄";
}

export default function DocumentCard({
  document,
  categories,
  onRename,
  onChangeCategory,
  onDelete,
}: {
  document: DocumentItem;
  categories: Category[];
  onRename: (id: string, title: string) => Promise<void>;
  onChangeCategory: (id: string, categoryId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [busy, setBusy] = useState(false);

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === document.title) {
      setTitle(document.title);
      setEditing(false);
      return;
    }
    setBusy(true);
    await onRename(document.id, trimmed);
    setBusy(false);
    setEditing(false);
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{iconFor(document.mimeType)}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setTitle(document.title);
                  setEditing(false);
                }
              }}
              className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm font-semibold focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              title="แก้ไขชื่อเอกสาร"
              className="block w-full truncate text-left text-sm font-semibold text-slate-900 hover:underline"
            >
              {document.title}
            </button>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {document.originalName}
          </p>
        </div>
      </div>

      {document.autoNamed && !editing && (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          ✨ ตั้งชื่ออัตโนมัติจากการสแกน
        </span>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{formatDate(document.createdAt)}</span>
        <span>{formatBytes(document.size)}</span>
      </div>

      <div className="mt-3">
        <select
          value={document.categoryId ?? ""}
          onChange={(e) => onChangeCategory(document.id, e.target.value || null)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">ไม่มีหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`/api/documents/${document.id}/download`}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-blue-700"
        >
          ดาวน์โหลด
        </a>
        {document.mimeType.startsWith("image/") || document.mimeType === "application/pdf" ? (
          <a
            href={`/api/documents/${document.id}/download?mode=inline`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ดูตัวอย่าง
          </a>
        ) : null}
        <button
          onClick={() => {
            if (confirm(`ลบเอกสาร "${document.title}"?`)) onDelete(document.id);
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          ลบ
        </button>
      </div>
    </div>
  );
}
