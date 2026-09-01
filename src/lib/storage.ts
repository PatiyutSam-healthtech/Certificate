import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export function userStorageDir(userId: string) {
  return path.join(STORAGE_ROOT, userId);
}

export async function saveUploadedFile(
  userId: string,
  fileName: string,
  buffer: Buffer,
) {
  const dir = userStorageDir(userId);
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, fileName);
  await writeFile(fullPath, buffer);
  return fullPath;
}

export async function readStoredFile(userId: string, fileName: string) {
  const fullPath = path.join(userStorageDir(userId), fileName);
  return readFile(fullPath);
}

export async function deleteStoredFile(userId: string, fileName: string) {
  const fullPath = path.join(userStorageDir(userId), fileName);
  try {
    await unlink(fullPath);
  } catch {
    // already gone; nothing to do
  }
}
