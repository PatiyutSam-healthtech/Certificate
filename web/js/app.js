/* DocVault frontend — vanilla JS, talks to the Apps Script backend via Api (api.js). */

const state = {
  categories: [],
  documents: [],
  stats: { total: 0, uncategorized: 0 },
  selectedCategoryId: null, // null = all, "none" = uncategorized
  searchQuery: "",
  selectedFile: null,
  selectedFilePreviewUrl: null,
  authMode: "login",
};

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
let selectedCategoryColor = PALETTE[0];

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${exp === 0 ? value : value.toFixed(1)} ${units[exp]}`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

// ---------------- view switching ----------------

function showAuthView() {
  $("dashboardView").hidden = true;
  $("authView").hidden = false;
}

function showDashboardView() {
  $("authView").hidden = true;
  $("dashboardView").hidden = false;
}

// ---------------- auth ----------------

function setAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === "register";
  $("authTitle").textContent = isRegister ? "สมัครสมาชิก DocVault" : "DocVault";
  $("authSubtitle").textContent = isRegister
    ? "สร้างบัญชีเพื่อเริ่มจัดเก็บเอกสารสำคัญของคุณ"
    : "เข้าสู่ระบบเพื่อจัดการเอกสารส่วนตัวของคุณ";
  $("nameField").hidden = !isRegister;
  $("passwordHint").hidden = !isRegister;
  $("authSubmit").textContent = isRegister ? "สมัครสมาชิก" : "เข้าสู่ระบบ";
  $("authSwitchText").textContent = isRegister ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?";
  $("authSwitchLink").textContent = isRegister ? "เข้าสู่ระบบ" : "สมัครสมาชิก";
  $("authError").hidden = true;
}

$("authSwitchLink").addEventListener("click", (e) => {
  e.preventDefault();
  setAuthMode(state.authMode === "login" ? "register" : "login");
});

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = $("authError");
  errorBox.hidden = true;
  const submitBtn = $("authSubmit");
  submitBtn.disabled = true;

  const payload = {
    name: $("nameInput").value,
    email: $("emailInput").value,
    password: $("passwordInput").value,
  };

  try {
    const data = await Api.call(state.authMode, payload);
    Auth.setSession(data.token, data.user);
    await enterDashboard();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await Api.call("logout", {});
  } catch {
    // ignore — clearing local session is enough
  }
  Auth.clear();
  showAuthView();
});

// ---------------- dashboard bootstrap ----------------

async function enterDashboard() {
  const user = Auth.getUser();
  $("userLabel").textContent = user?.name || user?.email || "";
  showDashboardView();
  await Promise.all([refreshCategories(), refreshDocuments()]);
}

async function refreshCategories() {
  const data = await Api.call("categories.list", {});
  state.categories = data.categories;
  state.stats = data.stats;
  renderCategories();
  renderCategorySelect();
}

async function refreshDocuments() {
  $("loadingLabel").hidden = false;
  $("documentGrid").hidden = true;
  $("emptyState").hidden = true;
  try {
    const params = {};
    if (state.searchQuery) params.q = state.searchQuery;
    if (state.selectedCategoryId) params.categoryId = state.selectedCategoryId;
    const data = await Api.call("documents.list", params);
    state.documents = data.documents;
    renderDocuments();
  } finally {
    $("loadingLabel").hidden = true;
  }
}

// ---------------- categories ----------------

function renderCategories() {
  const nav = $("categoryNav");
  const rows = [];

  rows.push(categoryRow(null, "เอกสารทั้งหมด", null, state.stats.total, false));
  state.categories.forEach((c) => {
    rows.push(categoryRow(c.id, c.name, c.color, c._count.documents, true));
  });
  rows.push(categoryRow("none", "ไม่มีหมวดหมู่", null, state.stats.uncategorized, false));

  nav.innerHTML = rows.join("");

  nav.querySelectorAll("[data-select-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-select-category");
      state.selectedCategoryId = value === "" ? null : value;
      refreshDocuments();
      renderCategories();
    });
  });

  nav.querySelectorAll("[data-delete-category]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-delete-category");
      const name = btn.getAttribute("data-category-name");
      if (confirm(`ลบหมวดหมู่ "${name}"?`)) deleteCategory(id);
    });
  });
}

function categoryRow(id, name, color, count, deletable) {
  const value = id === null ? "" : id;
  const active = state.selectedCategoryId === (id === null ? null : id);
  return `
    <div class="category-item${active ? " is-active" : ""}">
      <button type="button" class="category-item__main" data-select-category="${escapeHtml(value)}">
        <span class="category-item__label">
          ${color ? `<span class="category-dot" style="background:${escapeHtml(color)}"></span>` : ""}
          <span>${escapeHtml(name)}</span>
        </span>
        <span class="category-item__count">${count}</span>
      </button>
      ${
        deletable
          ? `<button type="button" class="category-delete" title="ลบหมวดหมู่" data-delete-category="${escapeHtml(id)}" data-category-name="${escapeHtml(name)}">✕</button>`
          : ""
      }
    </div>
  `;
}

function renderCategorySelect() {
  const select = $("uploadCategorySelect");
  const current = select.value;
  select.innerHTML =
    `<option value="">ไม่มีหมวดหมู่</option>` +
    state.categories
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
      .join("");
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function renderColorSwatches() {
  $("colorSwatches").innerHTML = PALETTE.map(
    (c) =>
      `<button type="button" class="color-swatch${c === selectedCategoryColor ? " is-selected" : ""}" style="background:${c}" data-color="${c}"></button>`,
  ).join("");
  $("colorSwatches").querySelectorAll(".color-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCategoryColor = btn.getAttribute("data-color");
      renderColorSwatches();
    });
  });
}

$("showCategoryFormBtn").addEventListener("click", () => {
  $("showCategoryFormBtn").hidden = true;
  $("categoryForm").hidden = false;
  renderColorSwatches();
  $("categoryNameInput").focus();
});

$("cancelCategoryBtn").addEventListener("click", () => {
  $("categoryForm").hidden = true;
  $("showCategoryFormBtn").hidden = false;
  $("categoryNameInput").value = "";
});

$("categoryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("categoryNameInput").value.trim();
  if (!name) return;
  try {
    await Api.call("categories.create", { name, color: selectedCategoryColor });
    $("categoryNameInput").value = "";
    $("categoryForm").hidden = true;
    $("showCategoryFormBtn").hidden = false;
    await refreshCategories();
  } catch (err) {
    alert(err.message);
  }
});

async function deleteCategory(id) {
  try {
    await Api.call("categories.delete", { id });
    if (state.selectedCategoryId === id) state.selectedCategoryId = null;
    await Promise.all([refreshCategories(), refreshDocuments()]);
  } catch (err) {
    alert(err.message);
  }
}

// ---------------- documents ----------------

function renderDocuments() {
  const grid = $("documentGrid");
  const empty = $("emptyState");

  if (state.documents.length === 0) {
    grid.hidden = true;
    empty.hidden = false;
    $("emptyStateText").textContent =
      state.searchQuery || state.selectedCategoryId
        ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข"
        : "ยังไม่มีเอกสาร เริ่มสแกนหรืออัปโหลดเอกสารแรกของคุณ";
    return;
  }

  grid.hidden = false;
  empty.hidden = true;
  grid.innerHTML = state.documents.map(documentCard).join("");

  grid.querySelectorAll("[data-edit-title]").forEach((btn) => {
    btn.addEventListener("click", () => startInlineRename(btn.closest(".doc-card")));
  });
  grid.querySelectorAll("[data-category-select]").forEach((select) => {
    select.addEventListener("change", () => {
      changeCategory(select.getAttribute("data-category-select"), select.value || null);
    });
  });
  grid.querySelectorAll("[data-download]").forEach((btn) => {
    btn.addEventListener("click", () => downloadDocument(btn.getAttribute("data-download"), false));
  });
  grid.querySelectorAll("[data-preview]").forEach((btn) => {
    btn.addEventListener("click", () => downloadDocument(btn.getAttribute("data-preview"), true));
  });
  grid.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete");
      const title = btn.getAttribute("data-title");
      if (confirm(`ลบเอกสาร "${title}"?`)) deleteDocument(id);
    });
  });
}

function iconFor(mimeType) {
  if (mimeType === "application/pdf") return "📕";
  if (mimeType.startsWith("image/")) return "🖼️";
  return "📄";
}

function documentCard(doc) {
  const previewable = doc.mimeType.startsWith("image/") || doc.mimeType === "application/pdf";
  return `
    <div class="doc-card" data-doc-id="${escapeHtml(doc.id)}">
      <div class="doc-card__head">
        <span class="doc-card__icon">${iconFor(doc.mimeType)}</span>
        <div class="doc-card__titlebox">
          <button type="button" class="doc-card__title" data-edit-title title="แก้ไขชื่อเอกสาร">${escapeHtml(doc.title)}</button>
          <p class="doc-card__filename">${escapeHtml(doc.originalName)}</p>
        </div>
      </div>
      ${doc.autoNamed ? `<span class="doc-card__badge">✨ ตั้งชื่ออัตโนมัติจากการสแกน</span>` : ""}
      <div class="doc-card__meta">
        <span>${formatDate(doc.createdAt)}</span>
        <span>${formatBytes(doc.size)}</span>
      </div>
      <select class="doc-card__category" data-category-select="${escapeHtml(doc.id)}">
        <option value="">ไม่มีหมวดหมู่</option>
        ${state.categories
          .map(
            (c) =>
              `<option value="${escapeHtml(c.id)}"${c.id === doc.categoryId ? " selected" : ""}>${escapeHtml(c.name)}</option>`,
          )
          .join("")}
      </select>
      <div class="doc-card__actions">
        <button type="button" class="btn btn--primary btn--flex" data-download="${escapeHtml(doc.id)}">ดาวน์โหลด</button>
        ${previewable ? `<button type="button" class="btn btn--outline" data-preview="${escapeHtml(doc.id)}">ดูตัวอย่าง</button>` : ""}
        <button type="button" class="btn btn--outline" data-delete="${escapeHtml(doc.id)}" data-title="${escapeHtml(doc.title)}" style="color:var(--danger)">ลบ</button>
      </div>
    </div>
  `;
}

function startInlineRename(cardEl) {
  const id = cardEl.getAttribute("data-doc-id");
  const doc = state.documents.find((d) => d.id === id);
  if (!doc) return;

  const titleBox = cardEl.querySelector(".doc-card__titlebox");
  const btn = cardEl.querySelector("[data-edit-title]");
  const input = document.createElement("input");
  input.type = "text";
  input.value = doc.title;
  input.className = "doc-card__title-input";

  titleBox.replaceChild(input, btn);
  input.focus();
  input.select();

  const commit = async () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== doc.title) {
      await renameDocument(id, newTitle);
    } else {
      renderDocuments();
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.removeEventListener("blur", commit);
      renderDocuments();
    }
  });
  input.addEventListener("blur", commit);
}

async function renameDocument(id, title) {
  try {
    await Api.call("documents.update", { id, title });
    await refreshDocuments();
  } catch (err) {
    alert(err.message);
    renderDocuments();
  }
}

async function changeCategory(id, categoryId) {
  try {
    await Api.call("documents.update", { id, categoryId });
    await Promise.all([refreshDocuments(), refreshCategories()]);
  } catch (err) {
    alert(err.message);
  }
}

async function deleteDocument(id) {
  try {
    await Api.call("documents.delete", { id });
    await Promise.all([refreshDocuments(), refreshCategories()]);
  } catch (err) {
    alert(err.message);
  }
}

async function downloadDocument(id, preview) {
  try {
    const data = await Api.call("documents.download", { id });
    const blob = base64ToBlob(data.base64, data.mimeType);
    const url = URL.createObjectURL(blob);
    if (preview) {
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      const ext = (state.documents.find((d) => d.id === id)?.originalName.match(/\.[^.]+$/) || [
        "",
      ])[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename + (data.filename.endsWith(ext) ? "" : ext);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (err) {
    alert(err.message);
  }
}

// ---------------- search ----------------

let searchDebounceTimer = null;
$("searchInput").addEventListener("input", (e) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    state.searchQuery = e.target.value.trim();
    refreshDocuments();
  }, 300);
});

// ---------------- upload modal ----------------

function openUploadModal() {
  $("uploadForm").reset();
  $("uploadError").hidden = true;
  state.selectedFile = null;
  if (state.selectedFilePreviewUrl) URL.revokeObjectURL(state.selectedFilePreviewUrl);
  state.selectedFilePreviewUrl = null;
  $("filePreviewImg").hidden = true;
  $("dropZoneIcon").hidden = false;
  $("dropZoneText").textContent = "แตะเพื่อสแกน/ถ่ายภาพ หรือเลือกไฟล์";
  if (state.selectedCategoryId && state.selectedCategoryId !== "none") {
    $("uploadCategorySelect").value = state.selectedCategoryId;
  }
  $("uploadModal").hidden = false;
}

function closeUploadModal() {
  $("uploadModal").hidden = true;
}

$("openUploadBtn").addEventListener("click", openUploadModal);
$("closeUploadBtn").addEventListener("click", closeUploadModal);
$("cancelUploadBtn").addEventListener("click", closeUploadModal);
$("dropZone").addEventListener("click", () => $("fileInput").click());

$("fileInput").addEventListener("change", () => {
  const file = $("fileInput").files[0];
  if (!file) return;
  state.selectedFile = file;
  $("dropZoneText").textContent = file.name;

  if (state.selectedFilePreviewUrl) URL.revokeObjectURL(state.selectedFilePreviewUrl);
  if (file.type.startsWith("image/")) {
    state.selectedFilePreviewUrl = URL.createObjectURL(file);
    $("filePreviewImg").src = state.selectedFilePreviewUrl;
    $("filePreviewImg").hidden = false;
    $("dropZoneIcon").hidden = true;
  } else {
    $("filePreviewImg").hidden = true;
    $("dropZoneIcon").hidden = false;
    $("dropZoneIcon").textContent = "📄";
  }
});

$("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = $("uploadError");
  errorBox.hidden = true;

  if (!state.selectedFile) {
    errorBox.textContent = "กรุณาเลือกไฟล์เอกสารหรือรูปภาพ";
    errorBox.hidden = false;
    return;
  }

  const submitBtn = $("submitUploadBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังสแกนและอัปโหลด...";

  try {
    const base64 = await fileToBase64(state.selectedFile);
    await Api.call("documents.upload", {
      filename: state.selectedFile.name,
      mimeType: state.selectedFile.type,
      base64,
      title: $("uploadTitleInput").value.trim(),
      categoryId: $("uploadCategorySelect").value,
    });
    closeUploadModal();
    await Promise.all([refreshDocuments(), refreshCategories()]);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "อัปโหลด";
  }
});

// ---------------- boot ----------------

(function boot() {
  setAuthMode("login");
  const token = Auth.getToken();
  const user = Auth.getUser();
  if (token && user) {
    enterDashboard().catch(() => {
      Auth.clear();
      showAuthView();
    });
  } else {
    showAuthView();
  }
})();
