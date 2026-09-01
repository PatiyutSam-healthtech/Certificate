import { randomUUID } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/storage";
import { generateAutoName } from "@/lib/autoName";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const categoryId = searchParams.get("categoryId");

  const where: Prisma.DocumentWhereInput = { userId: session.userId };

  if (categoryId === "none") {
    where.categoryId = null;
  } else if (categoryId) {
    where.categoryId = categoryId;
  }

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { originalName: { contains: q } },
      { extractedText: { contains: q } },
    ];
  }

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });

  return NextResponse.json({ documents });
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const categoryId = formData?.get("categoryId");
  const titleOverride = formData?.get("title");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: "รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, HEIC) และ PDF เท่านั้น" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 25MB)" },
      { status: 400 },
    );
  }

  if (typeof categoryId === "string" && categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: session.userId },
    });
    if (!category) {
      return NextResponse.json({ error: "ไม่พบหมวดหมู่ที่เลือก" }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension =
    EXTENSION_BY_MIME[file.type] ?? path.extname(file.name) ?? "";
  const storedFileName = `${randomUUID()}${extension}`;

  await saveUploadedFile(session.userId, storedFileName, buffer);

  let title: string;
  let autoNamed = false;
  let extractedText: string | null = null;

  if (typeof titleOverride === "string" && titleOverride.trim()) {
    title = titleOverride.trim().slice(0, 150);
  } else {
    const auto = await generateAutoName(buffer, file.type);
    title = auto.title;
    autoNamed = auto.autoNamed;
    extractedText = auto.extractedText || null;
  }

  const document = await prisma.document.create({
    data: {
      title,
      originalName: file.name,
      storedFileName,
      mimeType: file.type,
      size: file.size,
      extractedText,
      autoNamed,
      userId: session.userId,
      categoryId: typeof categoryId === "string" && categoryId ? categoryId : null,
    },
    include: { category: true },
  });

  return NextResponse.json({ document }, { status: 201 });
}
