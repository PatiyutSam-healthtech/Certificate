import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocVault - คลังเอกสารส่วนตัว",
  description: "เก็บ ค้นหา และจัดหมวดหมู่เอกสารสำคัญของคุณอย่างปลอดภัย",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
