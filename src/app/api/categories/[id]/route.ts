import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { categorySchema } from "@/lib/validation";

async function findOwnedCategory(userId: string, id: string) {
  return prisma.category.findFirst({ where: { id, userId } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const category = await findOwnedCategory(session.userId, id);
  if (!category) return NextResponse.json({ error: "ไม่พบหมวดหมู่" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const updated = await prisma.category.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ category: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const category = await findOwnedCategory(session.userId, id);
  if (!category) return NextResponse.json({ error: "ไม่พบหมวดหมู่" }, { status: 404 });

  await prisma.category.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
