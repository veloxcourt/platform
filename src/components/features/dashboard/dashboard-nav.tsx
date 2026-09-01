"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

import { saveNavOrderAction } from "@/app/(dashboard)/[clubSlug]/nav-actions";
import {
  NAV_TAB_LABELS,
  navTabHref,
  type AdminModuleKey,
  type NavTabId,
} from "@/config/modules";
import {
  getRememberedModulePath,
  navTabIdFromPathname,
  rememberModulePath,
} from "@/lib/module-nav-memory";
import { orderedNavTabs, type DashboardNavItem } from "@/lib/nav-tabs";
import { cn } from "@/lib/utils";

function moveTab(
  items: DashboardNavItem[],
  fromId: NavTabId,
  toId: NavTabId,
): DashboardNavItem[] {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function DashboardNav({
  clubSlug,
  allowedModules,
  navOrder,
}: {
  clubSlug: string;
  allowedModules: AdminModuleKey[];
  navOrder: string[];
  isOwner?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(() =>
    orderedNavTabs(allowedModules, navOrder),
  );
  const [dragId, setDragId] = useState<NavTabId | null>(null);
  const [overId, setOverId] = useState<NavTabId | null>(null);
  // Href con memoria (sessionStorage); se hidrata en cliente.
  const [hrefByTab, setHrefByTab] = useState<Partial<Record<NavTabId, string>>>(
    {},
  );
  const draggedRef = useRef(false);

  const allowedKey = allowedModules.join(",");
  const orderKey = navOrder.join(",");
  useEffect(() => {
    setItems(orderedNavTabs(allowedModules, navOrder));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync solo cuando cambia el snapshot del servidor
  }, [allowedKey, orderKey]);

  // Recordar última URL de cada módulo y usarla al volver a la pestaña.
  useEffect(() => {
    const tabIds = items.map((item) => item.id);
    const currentTab = navTabIdFromPathname(clubSlug, pathname, tabIds);
    if (currentTab) {
      const search = searchParams.toString();
      const full = search ? `${pathname}?${search}` : pathname;
      rememberModulePath(clubSlug, currentTab, full);
    }

    const next: Partial<Record<NavTabId, string>> = {};
    for (const item of items) {
      next[item.id] =
        getRememberedModulePath(clubSlug, item.id) ??
        navTabHref(clubSlug, item.id);
    }
    setHrefByTab(next);
  }, [clubSlug, pathname, searchParams, items]);

  const linkClass = (active: boolean, enabled: boolean) =>
    cn(
      "inline-flex items-center gap-1 whitespace-nowrap border-b-2 px-2 py-2 text-sm font-medium transition-colors",
      !enabled && "cursor-not-allowed text-muted-foreground/60",
      enabled &&
        (active
          ? "border-primary text-foreground"
          : "border-transparent text-foreground hover:border-primary/40"),
      !enabled && "border-transparent",
    );

  function onDragStart(id: NavTabId, e: React.DragEvent) {
    draggedRef.current = false;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOver(id: NavTabId, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }

  function onDrop(id: NavTabId, e: React.DragEvent) {
    e.preventDefault();
    const fromId = (e.dataTransfer.getData("text/plain") ||
      dragId) as NavTabId | null;
    if (!fromId || fromId === id) {
      setDragId(null);
      setOverId(null);
      return;
    }
    draggedRef.current = true;
    const next = moveTab(items, fromId, id);
    setItems(next);
    setDragId(null);
    setOverId(null);
    startTransition(async () => {
      const result = await saveNavOrderAction(
        clubSlug,
        next.map((item) => item.id),
      );
      if (!result.ok) {
        toast.error("No se pudo guardar el orden", {
          description: result.error,
        });
        setItems(orderedNavTabs(allowedModules, navOrder));
      }
    });
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  return (
    <nav
      className="flex gap-0.5 overflow-x-auto px-2"
      aria-label="Módulos del club. Arrastrá para reordenar."
    >
      {items.map((item) => {
        const href = hrefByTab[item.id] ?? navTabHref(clubSlug, item.id);
        const label = NAV_TAB_LABELS[item.id];
        const moduleBase = navTabHref(clubSlug, item.id);
        const active =
          pathname === moduleBase || pathname.startsWith(`${moduleBase}/`);
        const isDragging = dragId === item.id;
        const isOver = overId === item.id && dragId !== item.id;

        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => onDragStart(item.id, e)}
            onDragOver={(e) => onDragOver(item.id, e)}
            onDrop={(e) => onDrop(item.id, e)}
            onDragEnd={onDragEnd}
            title="Arrastrá para cambiar el orden"
            className={cn(
              "shrink-0 rounded-t-md",
              isDragging && "opacity-40",
              isOver && "bg-muted/70",
            )}
          >
            {item.enabled ? (
              <Link
                href={href}
                className={linkClass(active, true)}
                onClick={(e) => {
                  if (draggedRef.current) {
                    e.preventDefault();
                    draggedRef.current = false;
                  }
                }}
                draggable={false}
              >
                <GripVertical className="size-3.5 shrink-0 opacity-35" />
                {label}
              </Link>
            ) : (
              <span title="Próximamente" className={linkClass(false, false)}>
                <GripVertical className="size-3.5 shrink-0 opacity-35" />
                {label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
