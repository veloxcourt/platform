import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { DashboardNav } from "@/components/features/dashboard/dashboard-nav";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <CalendarClock className="size-4" />
            </span>
            CourtFlow
          </Link>
          <span className="text-sm text-muted-foreground">/ {clubSlug}</span>
        </div>

        <DashboardNav clubSlug={clubSlug} />
      </header>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
