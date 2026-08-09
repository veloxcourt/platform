"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ACTIVE_MODULES,
  MODULE_LABELS,
  MODULES,
  type AdminModuleKey,
} from "@/config/modules";
import { cn } from "@/lib/utils";

export function DashboardNav({
  clubSlug,
  allowedModules,
}: {
  clubSlug: string;
  allowedModules: AdminModuleKey[];
  isOwner?: boolean;
}) {
  const pathname = usePathname();
  const canSeeUpcoming =
    allowedModules.includes("tipos-usuario") ||
    allowedModules.includes("usuarios");

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (active: boolean) =>
    cn(
      "inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "border-primary text-foreground"
        : "border-transparent text-foreground hover:border-primary/40",
    );

  const fixedLinks = [
    { href: `/${clubSlug}/jugadores`, label: "Jugadores", module: "jugadores" },
    { href: `/${clubSlug}/catalogo`, label: "Catálogo", module: "catalogo" },
    {
      href: `/${clubSlug}/catalogo/menu`,
      label: "Menú de precios",
      module: "menu-precios",
    },
  ] satisfies { href: string; label: string; module: AdminModuleKey }[];

  return (
    <nav className="flex gap-1 overflow-x-auto px-2">
      {fixedLinks
        .filter((link) => allowedModules.includes(link.module))
        .map((link) => (
          <Link key={link.href} href={link.href}>
            <span className={linkClass(isActive(link.href))}>{link.label}</span>
          </Link>
        ))}

      {MODULES.map((mod) => {
        const href = `/${clubSlug}/${mod}`;
        const enabled = ACTIVE_MODULES.includes(mod);
        const permitted = allowedModules.includes(mod as AdminModuleKey);

        if (!enabled) {
          if (!canSeeUpcoming) return null;
          return (
            <span key={mod} title="Próximamente" className="cursor-not-allowed">
              <span className="inline-block whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground/60">
                {MODULE_LABELS[mod]}
              </span>
            </span>
          );
        }

        if (!permitted) return null;

        return (
          <Link key={mod} href={href}>
            <span className={linkClass(isActive(href))}>
              {MODULE_LABELS[mod]}
            </span>
          </Link>
        );
      })}

      {allowedModules.includes("tipos-usuario") ? (
        <Link href={`/${clubSlug}/tipos-usuario`}>
          <span className={linkClass(isActive(`/${clubSlug}/tipos-usuario`))}>
            Tipos de usuario
          </span>
        </Link>
      ) : null}

      {allowedModules.includes("usuarios") ? (
        <Link href={`/${clubSlug}/administradores`}>
          <span
            className={linkClass(isActive(`/${clubSlug}/administradores`))}
          >
            Usuarios
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
