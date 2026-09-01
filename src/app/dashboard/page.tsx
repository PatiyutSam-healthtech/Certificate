import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/Dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) redirect("/login");

  const [documents, categories] = await Promise.all([
    prisma.document.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    }),
  ]);

  return (
    <DashboardClient
      user={user}
      initialDocuments={JSON.parse(JSON.stringify(documents))}
      initialCategories={JSON.parse(JSON.stringify(categories))}
    />
  );
}
