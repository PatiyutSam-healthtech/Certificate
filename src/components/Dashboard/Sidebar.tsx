"use client";

import { useState, FormEvent } from "react";
import type { Category } from "@/lib/types";

const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#4b5563",
];

export default function Sidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  totalCount,
  uncategorizedCount,
  onCreateCategory,
  onDeleteCategory,
}: {
  categories: Category[];
  selectedCategoryId: string | null; // null = all, "none" = uncategorized
  onSelectCategory: (id: string | null) => void;
  totalCount: number;
  uncategorizedCount: number;
  onCreateCategory: (name: string, color: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreateCategory(name.trim(), color);
      setName("");
      setColor(PALETTE[0]);
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="w-full shrink-0 border-slate-200 md:w-64 md:border-r">
      <nav className="space-y-1 p-3">
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
            selectedCategoryId === null
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span>เอกสารทั้งหมด</span>
          <span className="text-xs text-slate-400">{totalCount}</span>
        </button>

        {categories.map((category) => (
          <div key={category.id} className="group flex items-center gap-1">
            <button
              onClick={() => onSelectCategory(category.id)}
              className={`flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                selectedCategoryId === category.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate">{category.name}</span>
              </span>
              <span className="text-xs text-slate-400">
                {category._count?.documents ?? 0}
              </span>
            </button>
            <button
              type="button"
              title="ลบหมวดหมู่"
              onClick={() => {
                if (confirm(`ลบหมวดหมู่ "${category.name}"?`)) {
                  onDeleteCategory(category.id);
                }
              }}
              className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:block"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={() => onSelectCategory("none")}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
            selectedCategoryId === "none"
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span>ไม่มีหมวดหมู่</span>
          <span className="text-xs text-slate-400">{uncategorizedCount}</span>
        </button>
      </nav>

      <div className="border-t border-slate-200 p-3">
        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อหมวดหมู่"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-5 w-5 rounded-full ${
                    color === c ? "ring-2 ring-offset-1 ring-slate-400" : ""
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                เพิ่ม
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600"
          >
            + เพิ่มหมวดหมู่
          </button>
        )}
      </div>
    </aside>
  );
}
