"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, DocumentItem } from "@/lib/types";
import Sidebar from "@/components/Dashboard/Sidebar";
import UploadModal from "@/components/Dashboard/UploadModal";
import DocumentCard from "@/components/Dashboard/DocumentCard";

type User = { id: string; email: string; name: string | null };
type Stats = { total: number; uncategorized: number };

export default function DashboardClient({
  user,
  initialDocuments,
  initialCategories,
}: {
  user: User;
  initialDocuments: DocumentItem[];
  initialCategories: Category[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [stats, setStats] = useState<Stats>({
    total: initialDocuments.length,
    uncategorized: initialDocuments.filter((d) => !d.categoryId).length,
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshDocuments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
    try {
      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategoryId]);

  const refreshCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories);
      setStats(data.stats);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-filter-change
    refreshDocuments();
  }, [refreshDocuments]);

  async function handleCreateCategory(name: string, color: string) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (res.ok) {
      await refreshCategories();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "ไม่สามารถเพิ่มหมวดหมู่ได้");
    }
  }

  async function handleDeleteCategory(id: string) {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      await Promise.all([refreshCategories(), refreshDocuments()]);
    }
  }

  async function handleUploaded() {
    setShowUpload(false);
    await Promise.all([refreshDocuments(), refreshCategories()]);
  }

  async function handleRename(id: string, title: string) {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const data = await res.json();
      setDocuments((prev) => prev.map((d) => (d.id === id ? data.document : d)));
    }
  }

  async function handleChangeCategory(id: string, categoryId: string | null) {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    if (res.ok) {
      await Promise.all([refreshDocuments(), refreshCategories()]);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      await Promise.all([refreshDocuments(), refreshCategories()]);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗂️</span>
          <span className="text-lg font-bold text-slate-900">DocVault</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {user.name || user.email}
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          totalCount={stats.total}
          uncategorizedCount={stats.uncategorized}
          onCreateCategory={handleCreateCategory}
          onDeleteCategory={handleDeleteCategory}
        />

        <main className="flex-1 p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อเอกสาร หรือข้อความในเอกสาร..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + เพิ่มเอกสาร
            </button>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-slate-400">กำลังโหลด...</p>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <span className="mb-2 text-4xl">📭</span>
              <p className="text-sm font-medium text-slate-600">
                {debouncedSearch || selectedCategoryId
                  ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข"
                  : "ยังไม่มีเอกสาร เริ่มสแกนหรืออัปโหลดเอกสารแรกของคุณ"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {documents.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  categories={categories}
                  onRename={handleRename}
                  onChangeCategory={handleChangeCategory}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {showUpload && (
        <UploadModal
          categories={categories}
          defaultCategoryId={
            selectedCategoryId && selectedCategoryId !== "none" ? selectedCategoryId : null
          }
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
