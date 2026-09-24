"use client";

import { usePathname, useRouter } from "next/navigation";
import { List, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { JUGADORES_TABS } from "@/config/modules";
import { StableTabButton } from "@/components/ui/stable-tab-button";

const TAB_ICONS: Record<(typeof JUGADORES_TABS)[number]["slug"], LucideIcon> = {
  listado: List,
  herramientas: Wrench,
};

export function JugadoresSubnav({ clubSlug }: { clubSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${clubSlug}/jugadores`;

  return (
    <div
      className="flex min-w-0 items-center gap-2 overflow-x-auto"
      role="tablist"
      aria-label="Jugadores"
    >
      {JUGADORES_TABS.map((tab) => {
        const href = tab.slug === "listado" ? base : `${base}/${tab.slug}`;
        const active =
          tab.slug === "listado"
            ? pathname === base || pathname === `${base}/`
            : pathname === href || pathname.startsWith(`${href}/`);
        const Icon = TAB_ICONS[tab.slug];

        return (
          <StableTabButton
            key={tab.slug}
            active={active}
            onSelect={() => router.push(href)}
          >
            <Icon />
            {tab.label}
          </StableTabButton>
        );
      })}
    </div>
  );
}
