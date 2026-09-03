"use client";

import { usePathname, useRouter } from "next/navigation";
import { List } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { TORNEOS_TABS } from "@/config/modules";
import { StableTabButton } from "@/components/ui/stable-tab-button";

const TAB_ICONS: Partial<
  Record<(typeof TORNEOS_TABS)[number]["slug"], LucideIcon>
> = {
  listado: List,
};

export function TorneosSubnav({ clubSlug }: { clubSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${clubSlug}/torneos`;

  // Solo Listado: no hace falta fila de pestañas (Soporte está en Configuración).
  if (TORNEOS_TABS.length <= 1) return null;

  return (
    <div
      className="flex min-w-0 items-center gap-2 overflow-x-auto"
      role="tablist"
      aria-label="Torneos"
    >
      {TORNEOS_TABS.map((tab) => {
        const href = tab.slug === "listado" ? base : `${base}/${tab.slug}`;
        const active =
          tab.slug === "listado"
            ? pathname === base
            : pathname === href || pathname.startsWith(`${href}/`);
        const Icon = TAB_ICONS[tab.slug];

        return (
          <StableTabButton
            key={tab.slug}
            active={active}
            onSelect={() => router.push(href)}
          >
            {Icon ? <Icon /> : null}
            {tab.label}
          </StableTabButton>
        );
      })}
    </div>
  );
}
