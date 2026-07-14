"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HERRAMIENTAS_TABS } from "@/config/modules";
import { cn } from "@/lib/utils";

export function HerramientasSubnav({ clubSlug }: { clubSlug: string }) {
  const pathname = usePathname();
  const base = `/${clubSlug}/herramientas`;

  return (
    <nav className="flex gap-1 border-b">
      {HERRAMIENTAS_TABS.map((tab) => {
        const href = `${base}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link key={tab.slug} href={href}>
            <span
              className={cn(
                "inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
