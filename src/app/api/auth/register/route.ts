import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ข้อมูลไม่ถูกต้อง กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 8 ตัวอักษร" },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
      categories: {
        create: [
          { name: "ทั่วไป", color: "#2563eb" },
          { name: "เอกสารราชการ", color: "#16a34a" },
          { name: "การเงิน", color: "#d97706" },
          { name: "สุขภาพ", color: "#dc2626" },
        ],
      },
    },
  });

  const token = await createSessionToken({ userId: user.id, email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
