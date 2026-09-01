var ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

// Base64 inflates size by ~33%, and Apps Script Web App responses/requests
// have their own size ceilings — keep well under them.
var MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

function documentsForUser_(userId) {
  return getAllRows_("Documents").filter(function (d) {
    return d.userId === userId;
  });
}

function findOwnedDocument_(userId, id) {
  var doc = findById_("Documents", id);
  if (!doc || doc.userId !== userId) return null;
  return doc;
}

function toDocumentDto_(doc) {
  var category = doc.categoryId ? findById_("Categories", doc.categoryId) : null;
  return {
    id: doc.id,
    title: doc.title,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: Number(doc.size) || 0,
    autoNamed: doc.autoNamed === true || doc.autoNamed === "true",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    categoryId: doc.categoryId || null,
    category: category
      ? { id: category.id, name: category.name, color: category.color }
      : null,
  };
}

function Documents_list(userId, p) {
  var docs = documentsForUser_(userId);

  var categoryId = p.categoryId;
  if (categoryId === "none") {
    docs = docs.filter(function (d) {
      return !d.categoryId;
    });
  } else if (categoryId) {
    docs = docs.filter(function (d) {
      return d.categoryId === categoryId;
    });
  }

  var q = String(p.q || "").trim().toLowerCase();
  if (q) {
    docs = docs.filter(function (d) {
      return (
        String(d.title).toLowerCase().indexOf(q) !== -1 ||
        String(d.originalName).toLowerCase().indexOf(q) !== -1 ||
        String(d.extractedText || "").toLowerCase().indexOf(q) !== -1
      );
    });
  }

  docs.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return { documents: docs.map(toDocumentDto_) };
}

function Documents_upload(userId, p) {
  var filename = String(p.filename || "").trim();
  var mimeType = String(p.mimeType || "");
  var base64 = p.base64;

  if (!filename || !base64) throw new Error("กรุณาเลือกไฟล์");
  if (ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, HEIC) และ PDF เท่านั้น");
  }

  var bytes = Utilities.base64Decode(base64);
  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 8MB)");
  }

  var categoryId = p.categoryId ? String(p.categoryId) : "";
  if (categoryId && !Categories_findOwned_(userId, categoryId)) {
    throw new Error("ไม่พบหมวดหมู่ที่เลือก");
  }

  var blob = Utilities.newBlob(bytes, mimeType, filename);
  var file = getUserFolder_(userId).createFile(blob);

  var title = String(p.title || "").trim();
  var autoNamed = false;
  var extractedText = "";

  if (!title) {
    extractedText = tryExtractText_(file, mimeType);
    title = titleFromText_(extractedText) || fallbackTitle_(mimeType);
    autoNamed = true;
  }

  var now = new Date().toISOString();
  var doc = {
    id: Utilities.getUuid(),
    userId: userId,
    categoryId: categoryId,
    title: title.slice(0, 150),
    originalName: filename,
    driveFileId: file.getId(),
    mimeType: mimeType,
    size: bytes.length,
    extractedText: extractedText,
    autoNamed: autoNamed,
    createdAt: now,
    updatedAt: now,
  };
  insertRow_("Documents", doc);
  return { document: toDocumentDto_(doc) };
}

/**
 * Best-effort OCR: copy the file into Google Docs format, which makes
 * Drive run OCR automatically on image content (and on scanned PDFs),
 * read the resulting text, then delete the temporary Doc. Never throws —
 * upload must succeed even if OCR fails or the Drive Advanced Service
 * isn't enabled yet.
 */
function tryExtractText_(file, mimeType) {
  var tempId = null;
  try {
    var copy = Drive.Files.copy(
      { name: "docvault-ocr-temp", mimeType: MimeType.GOOGLE_DOCS },
      file.getId(),
    );
    tempId = copy.id;
    var text = DocumentApp.openById(tempId).getBody().getText();
    return text || "";
  } catch (err) {
    Logger.log("OCR extraction failed: " + err);
    return "";
  } finally {
    if (tempId) {
      try {
        Drive.Files.remove(tempId);
      } catch (cleanupErr) {
        Logger.log("Failed to clean up temp OCR doc: " + cleanupErr);
      }
    }
  }
}

function titleFromText_(text) {
  if (!text) return null;
  var lines = String(text)
    .split(/\r?\n/)
    .map(function (line) {
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(function (line) {
      return line.length >= 3;
    });

  var candidate = lines.find(function (line) {
    return /[\p{L}\p{N}]/u.test(line);
  });
  if (!candidate) return null;

  var cleaned = candidate.replace(/[\\/:*?"<>|]/g, "").trim();
  if (cleaned.length < 3) return null;

  return cleaned.length > 60 ? cleaned.slice(0, 60).trim() + "..." : cleaned;
}

function fallbackTitle_(mimeType) {
  var kind = mimeType === "application/pdf" ? "เอกสาร PDF" : "เอกสารสแกน";
  var stamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd_HH:mm");
  return kind + "-" + stamp;
}

function Documents_update(userId, p) {
  var doc = findOwnedDocument_(userId, p.id);
  if (!doc) throw new Error("ไม่พบเอกสาร");

  var patch = { updatedAt: new Date().toISOString() };

  if (p.title !== undefined) {
    var title = String(p.title).trim();
    if (!title) throw new Error("ชื่อเอกสารไม่ถูกต้อง");
    patch.title = title.slice(0, 150);
    patch.autoNamed = false;
  }

  if (p.categoryId !== undefined) {
    var categoryId = p.categoryId ? String(p.categoryId) : "";
    if (categoryId && !Categories_findOwned_(userId, categoryId)) {
      throw new Error("ไม่พบหมวดหมู่ที่เลือก");
    }
    patch.categoryId = categoryId;
  }

  var updated = updateById_("Documents", p.id, patch);
  return { document: toDocumentDto_(updated) };
}

function Documents_delete(userId, p) {
  var doc = findOwnedDocument_(userId, p.id);
  if (!doc) throw new Error("ไม่พบเอกสาร");

  try {
    DriveApp.getFileById(doc.driveFileId).setTrashed(true);
  } catch (err) {
    Logger.log("Failed to trash Drive file: " + err);
  }
  deleteById_("Documents", p.id);
  return { ok: true };
}

function Documents_download(userId, p) {
  var doc = findOwnedDocument_(userId, p.id);
  if (!doc) throw new Error("ไม่พบเอกสาร");

  var file = DriveApp.getFileById(doc.driveFileId);
  var bytes = file.getBlob().getBytes();

  return {
    filename: doc.title,
    mimeType: doc.mimeType,
    base64: Utilities.base64Encode(bytes),
  };
}
