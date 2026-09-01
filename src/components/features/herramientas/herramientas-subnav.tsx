"use client";

import { useRouter, usePathname } from "next/navigation";
import { Calculator, CalendarDays } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  HERRAMIENTAS_TABS,
  type AdminModuleKey,
} from "@/config/modules";
import { StableTabButton } from "@/components/ui/stable-tab-button";

const TAB_ICONS: Record<(typeof HERRAMIENTAS_TABS)[number]["slug"], LucideIcon> =
  {
    "eco-torneo": Calculator,
    calendario: CalendarDays,
  };

export function HerramientasSubnav({
  clubSlug,
  allowedModules,
}: {
  clubSlug: string;
  allowedModules: AdminModuleKey[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${clubSlug}/herramientas`;
  const tabs = HERRAMIENTAS_TABS.filter((tab) =>
    allowedModules.includes(tab.privilege),
  );

  return (
    <div
      className="flex min-w-0 items-center gap-2 overflow-x-auto"
      role="tablist"
      aria-label="Herramientas"
    >
      {tabs.map((tab) => {
        const href = `${base}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
