import { execFile } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { PDFParse } from "pdf-parse";

const execFileAsync = promisify(execFile);
const OCR_TIMEOUT_MS = 25_000;
const OCR_WORKER_SCRIPT = path.join(process.cwd(), "scripts", "ocr-worker.cjs");

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * OCR runs in a separate child process (with a hard timeout) rather than
 * in-process. tesseract.js can hang or throw from an internal worker
 * thread in ways that bypass normal promise rejection (e.g. a stalled
 * language-data download), which would otherwise crash or wedge the main
 * server process. Isolating it means a bad run just gets killed and we
 * fall back to a heuristic title.
 */
async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "docvault-ocr-"));
  const imagePath = path.join(dir, "input");
  try {
    await writeFile(imagePath, buffer);
    const { stdout } = await execFileAsync(
      process.execPath,
      [OCR_WORKER_SCRIPT, imagePath],
      { timeout: OCR_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout) as { text?: string };
    return parsed.text ?? "";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await withTimeout(parser.getText(), OCR_TIMEOUT_MS);
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/** Best-effort text extraction; returns "" (never throws) on failure. */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      return await extractTextFromPdf(buffer);
    }
    if (mimeType.startsWith("image/")) {
      return await extractTextFromImage(buffer);
    }
    return "";
  } catch (err) {
    console.error("Text extraction failed:", err);
    return "";
  }
}

/**
 * Turns raw extracted text into a short, human-friendly title by picking
 * the first substantial line and trimming it to a sane length.
 */
function titleFromText(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3);

  const candidate = lines.find((line) => /[\p{L}\p{N}]/u.test(line));
  if (!candidate) return null;

  const cleaned = candidate.replace(/[\\/:*?"<>|]/g, "").trim();
  if (cleaned.length < 3) return null;

  return cleaned.length > 60 ? `${cleaned.slice(0, 60).trim()}...` : cleaned;
}

function fallbackTitle(mimeType: string, date: Date): string {
  const kind = mimeType === "application/pdf" ? "เอกสาร PDF" : "เอกสารสแกน";
  const stamp = date
    .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
    .replace(" ", "_")
    .slice(0, 16);
  return `${kind}-${stamp}`;
}

export type AutoNameResult = {
  title: string;
  autoNamed: boolean;
  extractedText: string;
};

export async function generateAutoName(
  buffer: Buffer,
  mimeType: string,
): Promise<AutoNameResult> {
  const extractedText = await extractText(buffer, mimeType);
  const derived = titleFromText(extractedText);

  if (derived) {
    return { title: derived, autoNamed: true, extractedText };
  }

  return {
    title: fallbackTitle(mimeType, new Date()),
    autoNamed: true,
    extractedText,
  };
}
