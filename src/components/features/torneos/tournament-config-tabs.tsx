"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Layers, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CatalogCategory } from "@/modules/herramientas/domain/calendario-torneos";
import type {
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { StableTabButton } from "@/components/ui/stable-tab-button";
import { copyCategoryPhaseConfigAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/configuracion/actions";
import {
  bindFieldMenuTrigger,
  consumedHoldClick,
  type MenuPoint,
} from "./field-menu-trigger";
import { TournamentCategoriesPanel } from "./tournament-categories-panel";
import { TournamentConfigForm } from "./tournament-config-form";
import { useTournamentReadOnly } from "./tournament-mode-context";

const PARAMETERS_TAB = "parametros" as const;
const CATEGORIES_TAB = "categorias" as const;

type ConfigSubTab =
  | typeof PARAMETERS_TAB
  | typeof CATEGORIES_TAB
  | string;

type CategoryContextMenuState = {
  x: number;
  y: number;
  targetCategoryId: string;
  submenu: "root" | "copyTo" | "cloneFrom";
};

export function TournamentConfigTabs({
  clubSlug,
  tournamentId,
  categories,
  catalogCategories,
  config,
  courtCount,
  header,
}: {
  clubSlug: string;
  tournamentId: string;
  categories: TournamentCategoryItem[];
  catalogCategories: CatalogCategory[];
  config: TournamentConfig | null;
  courtCount: number;
  /// Título y pestañas principales: van fijos junto a esta subnavegación.
  header?: ReactNode;
}) {
  const readOnly = useTournamentReadOnly();
  const [subTab, setSubTab] = useState<ConfigSubTab>(CATEGORIES_TAB);
  const [menu, setMenu] = useState<CategoryContextMenuState | null>(null);
  const [isCopying, startCopy] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuHoldRef = useRef<number | null>(null);

  useEffect(() => {
    if (subTab === PARAMETERS_TAB || subTab === CATEGORIES_TAB) {
      return;
    }
    const stillThere = categories.some((category) => category.id === subTab);
    if (!stillThere) {
      setMenu(null);
      setSubTab(CATEGORIES_TAB);
    }
  }, [categories, subTab]);

  useEffect(() => {
    if (!menu) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest("[data-category-menu-tab]")
      ) {
        return;
      }
      setMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    function onScroll() {
      setMenu(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  function openCategoryMenu(point: MenuPoint, categoryId: string) {
    if (readOnly || categories.length < 2) return;
    setMenu({
      x: point.x,
      y: point.y,
      targetCategoryId: categoryId,
      submenu: "root",
    });
  }

  function menuPointFromTab(event: { currentTarget: HTMLElement }): MenuPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 4 };
  }

  function copyConfig(sourceCategoryId: string, targetCategoryId: string) {
    if (isCopying) return;
    const source = categories.find((c) => c.id === sourceCategoryId);
    const target = categories.find((c) => c.id === targetCategoryId);
    setMenu(null);
    startCopy(async () => {
      const result = await copyCategoryPhaseConfigAction(
        clubSlug,
        tournamentId,
        sourceCategoryId,
        targetCategoryId,
      );
      if (!result.ok) {
        toast.error("No se pudo copiar la configuración", {
          description: result.error,
        });
        return;
      }
      toast.success(
        `Configuración de ${source?.name ?? "origen"} copiada a ${target?.name ?? "destino"}`,
      );
      setSubTab(targetCategoryId);
    });
  }

  const menuTarget = menu
    ? categories.find((c) => c.id === menu.targetCategoryId)
    : null;
  const otherCategories = menu
    ? categories.filter((c) => c.id !== menu.targetCategoryId)
    : [];

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-30 shrink-0 -mx-4 -mt-4 border-b bg-background px-4 pt-4 pb-3">
        {header}
        <div
          className={header ? "mt-3" : undefined}
        >
      <div
        className="flex w-full min-w-0 items-center gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Secciones de configuración"
      >
        <StableTabButton
          active={subTab === CATEGORIES_TAB}
          onSelect={() => {
            setMenu(null);
            setSubTab(CATEGORIES_TAB);
          }}
        >
          <Layers />
          Categorías
        </StableTabButton>
        <StableTabButton
          active={subTab === PARAMETERS_TAB}
          onSelect={() => {
            setMenu(null);
            setSubTab(PARAMETERS_TAB);
          }}
        >
          <SlidersHorizontal />
          Parámetros
        </StableTabButton>
        {categories.map((category) => {
          const canCopy = !readOnly && categories.length >= 2;
          const isActive = subTab === category.id;
          return (
            <StableTabButton
              key={category.id}
              active={isActive}
              data-category-menu-tab=""
              aria-haspopup={canCopy ? "menu" : undefined}
              aria-expanded={
                canCopy ? menu?.targetCategoryId === category.id : undefined
              }
              onSelect={(event) => {
                if (consumedHoldClick(menuHoldRef)) return;
                if (isActive && canCopy) {
                  if (menu?.targetCategoryId === category.id) {
                    setMenu(null);
                    return;
                  }
                  openCategoryMenu(menuPointFromTab(event), category.id);
                  return;
                }
                setMenu(null);
                setSubTab(category.id);
              }}
              {...bindFieldMenuTrigger(
                canCopy,
                (point) => openCategoryMenu(point, category.id),
                menuHoldRef,
              )}
              title={
                canCopy
                  ? isActive
                    ? "Clic de nuevo: copiar o clonar la configuración"
                    : "Clic derecho o mantené 2 s: copiar o clonar la configuración"
                  : undefined
              }
              className={canCopy ? "select-none" : undefined}
            >
              {category.name}
            </StableTabButton>
          );
        })}
      </div>
        </div>
      </div>

      <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-clip overflow-y-auto pt-4">
      {subTab === PARAMETERS_TAB ? (
        config ? (
          <TournamentConfigForm
            clubSlug={clubSlug}
            tournamentId={tournamentId}
            initial={config}
            categories={categories}
            panel="parameters"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Parámetros</CardTitle>
              <CardDescription>
                Todavía no hay configuración guardada. Agregá categorías y
                volvé a esta pestaña.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : subTab === CATEGORIES_TAB ? (
        <TournamentCategoriesPanel
          clubSlug={clubSlug}
          tournamentId={tournamentId}
          categories={categories}
          catalogCategories={catalogCategories}
          config={config}
          courtCount={courtCount}
          showInscriptionStats={false}
        />
      ) : config ? (
        <TournamentConfigForm
          key={`${subTab}-${config.categories
            .map(
              (c) =>
                `${c.categoryId}:${c.phases.zones.matchDurationMin}:${c.phases.zones.playDates.join(",")}`,
            )
            .join("|")}`}
          clubSlug={clubSlug}
          tournamentId={tournamentId}
          initial={config}
          categories={categories}
          panel="category"
          focusCategoryId={subTab}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configuración de categoría</CardTitle>
            <CardDescription>
              Todavía no hay configuración guardada. Agregá categorías y
              volvé a esta pestaña.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      </div>

      {menu && menuTarget ? (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-52 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          style={{
            left: Math.min(menu.x, window.innerWidth - 220),
            top: Math.min(menu.y, window.innerHeight - 220),
          }}
        >
          {menu.submenu === "root" ? (
            <>
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {menuTarget.name}
              </p>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                disabled={otherCategories.length === 0 || isCopying}
                onClick={() => setMenu({ ...menu, submenu: "copyTo" })}
              >
                Copiar
                <ChevronRight className="size-4 shrink-0 opacity-60" />
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                disabled={otherCategories.length === 0 || isCopying}
                onClick={() => setMenu({ ...menu, submenu: "cloneFrom" })}
              >
                Clonar
                <ChevronRight className="size-4 shrink-0 opacity-60" />
              </button>
            </>
          ) : menu.submenu === "copyTo" ? (
            <>
              <button
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMenu({ ...menu, submenu: "root" })}
              >
                ← Volver
              </button>
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Copiar {menuTarget.name} a
              </p>
              {otherCategories.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  disabled={isCopying}
                  onClick={() =>
                    copyConfig(menu.targetCategoryId, destination.id)
                  }
                >
                  {destination.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMenu({ ...menu, submenu: "root" })}
              >
                ← Volver
              </button>
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Clonar en {menuTarget.name} desde
              </p>
              {otherCategories.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  disabled={isCopying}
                  onClick={() =>
                    copyConfig(source.id, menu.targetCategoryId)
                  }
                >
                  {source.name}
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
