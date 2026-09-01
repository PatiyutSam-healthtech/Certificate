import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { categorySchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [categories, total, uncategorized] = await Promise.all([
    prisma.category.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    }),
    prisma.document.count({ where: { userId: session.userId } }),
    prisma.document.count({
      where: { userId: session.userId, categoryId: null },
    }),
  ]);

  return NextResponse.json({ categories, stats: { total, uncategorized } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ชื่อหมวดหมู่ไม่ถูกต้อง" }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({
    where: { userId_name: { userId: session.userId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "มีหมวดหมู่นี้อยู่แล้ว" }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: { ...parsed.data, userId: session.userId },
  });

  return NextResponse.json({ category }, { status: 201 });
}
