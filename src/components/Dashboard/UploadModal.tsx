"use client";

import { useState, useRef, FormEvent } from "react";
import type { Category, DocumentItem } from "@/lib/types";

export default function UploadModal({
  categories,
  defaultCategoryId,
  onClose,
  onUploaded,
}: {
  categories: Category[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onUploaded: (document: DocumentItem) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(
      selected && selected.type.startsWith("image/")
        ? URL.createObjectURL(selected)
        : null,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("กรุณาเลือกไฟล์เอกสารหรือรูปภาพ");
      return;
    }
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (title.trim()) formData.append("title", title.trim());
    if (categoryId) formData.append("categoryId", categoryId);

    try {
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "อัปโหลดไม่สำเร็จ");
        setUploading(false);
        return;
      }
      onUploaded(data.document);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">เพิ่มเอกสารใหม่</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-blue-400"
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="ตัวอย่างเอกสาร"
                  className="max-h-40 rounded-lg object-contain"
                />
              ) : file ? (
                <span className="text-3xl">📄</span>
              ) : (
                <span className="text-3xl">📷</span>
              )}
              <span className="text-sm font-medium text-slate-700">
                {file ? file.name : "แตะเพื่อสแกน/ถ่ายภาพ หรือเลือกไฟล์"}
              </span>
              <span className="text-xs text-slate-400">
                รองรับ JPG, PNG, WEBP, HEIC, PDF (ไม่เกิน 25MB)
              </span>
            </label>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อเอกสาร (ไม่บังคับ)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ถ้าไม่ระบุ ระบบจะสแกนและตั้งชื่อให้อัตโนมัติ"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              หมวดหมู่ (ไม่บังคับ)
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">ไม่มีหมวดหมู่</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "กำลังสแกนและอัปโหลด..." : "อัปโหลด"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
