"use client";

import { useRouter, usePathname } from "next/navigation";
import { Building2, Shield, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  CONTROL_USUARIOS_TABS,
  type AdminModuleKey,
} from "@/config/modules";
import { StableTabButton } from "@/components/ui/stable-tab-button";

const TAB_ICONS: Record<string, LucideIcon> = {
  club: Building2,
  "tipo-usuario": Shield,
  usuarios: Users,
};

export function ControlUsuariosSubnav({
  clubSlug,
  allowedModules,
  isClubOwner = false,
}: {
  clubSlug: string;
  allowedModules: AdminModuleKey[];
  isClubOwner?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${clubSlug}/control-usuarios`;
  const tabs = [
    ...(isClubOwner ? [{ slug: "club", label: "Club" }] : []),
    ...CONTROL_USUARIOS_TABS.filter((tab) =>
      allowedModules.includes(tab.privilege),
    ),
  ];

  return (
    <div
      className="flex min-w-0 items-center gap-2 overflow-x-auto"
      role="tablist"
      aria-label="Control Usuarios"
    >
      {tabs.map((tab) => {
        const href = `${base}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = TAB_ICONS[tab.slug] ?? Users;

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
