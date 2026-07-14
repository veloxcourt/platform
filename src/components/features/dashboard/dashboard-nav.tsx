"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ACTIVE_MODULES, MODULE_LABELS, MODULES } from "@/config/modules";
import { cn } from "@/lib/utils";

export function DashboardNav({ clubSlug }: { clubSlug: string }) {
  const pathname = usePathname();

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
    { href: `/${clubSlug}/jugadores`, label: "Jugadores" },
    { href: `/${clubSlug}/catalogo`, label: "Catálogo" },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto px-2">
      {fixedLinks.map((link) => (
        <Link key={link.href} href={link.href}>
          <span className={linkClass(isActive(link.href))}>{link.label}</span>
        </Link>
      ))}

      {MODULES.map((mod) => {
        const href = `/${clubSlug}/${mod}`;
        const enabled = ACTIVE_MODULES.includes(mod);

        if (!enabled) {
          return (
            <span key={mod} title="Próximamente" className="cursor-not-allowed">
              <span className="inline-block whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground/60">
                {MODULE_LABELS[mod]}
              </span>
            </span>
          );
        }

        return (
          <Link key={mod} href={href}>
            <span className={linkClass(isActive(href))}>
              {MODULE_LABELS[mod]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
