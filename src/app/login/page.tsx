import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">DocVault</h1>
          <p className="mt-1 text-sm text-slate-500">
            เข้าสู่ระบบเพื่อจัดการเอกสารส่วนตัวของคุณ
          </p>
        </div>
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
        <p className="mt-6 text-center text-sm text-slate-500">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="font-medium text-blue-600 hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </main>
  );
}
