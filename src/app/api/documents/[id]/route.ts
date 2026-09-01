import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/storage";
import { documentUpdateSchema } from "@/lib/validation";

async function findOwnedDocument(userId: string, id: string) {
  return prisma.document.findFirst({ where: { id, userId } });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: session.userId },
    include: { category: true },
  });
  if (!document) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });

  return NextResponse.json({ document });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await findOwnedDocument(session.userId, id);
  if (!document) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = documentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.userId },
    });
    if (!category) {
      return NextResponse.json({ error: "ไม่พบหมวดหมู่ที่เลือก" }, { status: 400 });
    }
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined
        ? { title: parsed.data.title, autoNamed: false }
        : {}),
      ...(parsed.data.categoryId !== undefined
        ? { categoryId: parsed.data.categoryId }
        : {}),
    },
    include: { category: true },
  });

  return NextResponse.json({ document: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await findOwnedDocument(session.userId, id);
  if (!document) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });

  await prisma.document.delete({ where: { id } });
  await deleteStoredFile(session.userId, document.storedFileName);

  return NextResponse.json({ ok: true });
}
