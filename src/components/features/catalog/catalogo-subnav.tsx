"use client";

import { usePathname, useRouter } from "next/navigation";
import { List, ListOrdered } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  CATALOGO_TABS,
  catalogoTabHref,
  type AdminModuleKey,
  type CatalogoTabSlug,
} from "@/config/modules";
import { StableTabButton } from "@/components/ui/stable-tab-button";

const TAB_ICONS: Record<CatalogoTabSlug, LucideIcon> = {
  listado: List,
  menu: ListOrdered,
};

export function CatalogoSubnav({
  clubSlug,
  allowedModules,
}: {
  clubSlug: string;
  allowedModules: AdminModuleKey[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = CATALOGO_TABS.filter(
    (tab) =>
      allowedModules.includes(tab.privilege) ||
      (tab.slug === "menu" && allowedModules.includes("catalogo")),
  );

  return (
    <div
      className="flex min-w-0 items-center gap-2 overflow-x-auto"
      role="tablist"
      aria-label="Catálogo"
    >
      {tabs.map((tab) => {
        const href = catalogoTabHref(clubSlug, tab.slug);
        const active =
          tab.slug === "listado"
            ? pathname === href || pathname === `${href}/`
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
