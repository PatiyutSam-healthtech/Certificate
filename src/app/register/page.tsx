import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">สมัครสมาชิก DocVault</h1>
          <p className="mt-1 text-sm text-slate-500">
            สร้างบัญชีเพื่อเริ่มจัดเก็บเอกสารสำคัญของคุณ
          </p>
        </div>
        <Suspense>
          <AuthForm mode="register" />
        </Suspense>
        <p className="mt-6 text-center text-sm text-slate-500">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
