import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { readStoredFile } from "@/lib/storage";

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "document";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: session.userId },
  });
  if (!document) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });

  const buffer = await readStoredFile(session.userId, document.storedFileName).catch(
    () => null,
  );
  if (!buffer) {
    return NextResponse.json({ error: "ไม่พบไฟล์บนเซิร์ฟเวอร์" }, { status: 404 });
  }

  const extension = path.extname(document.storedFileName);
  const fileName = `${sanitizeFileName(document.title)}${extension}`;
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_");
  const disposition =
    request.nextUrl.searchParams.get("mode") === "inline" ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
