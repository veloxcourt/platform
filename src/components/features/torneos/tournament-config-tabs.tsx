"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { BookOpen, Layers, SlidersHorizontal } from "lucide-react";
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
import { TournamentCategoriesPanel } from "./tournament-categories-panel";
import { TournamentConfigForm } from "./tournament-config-form";
import { TorneosSoporteView } from "./torneos-soporte-view";
import { useTournamentReadOnly } from "./tournament-mode-context";

const PARAMETERS_TAB = "parametros" as const;
const CATEGORIES_TAB = "categorias" as const;
const SUPPORT_TAB = "soporte" as const;

type ConfigSubTab =
  | typeof PARAMETERS_TAB
  | typeof CATEGORIES_TAB
  | typeof SUPPORT_TAB
  | string;

type CategoryContextMenuState = {
  x: number;
  y: number;
  targetCategoryId: string;
  submenu: "root" | "copyFrom";
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
  const [subTab, setSubTab] = useState<ConfigSubTab>(PARAMETERS_TAB);
  const [menu, setMenu] = useState<CategoryContextMenuState | null>(null);
  const [isCopying, startCopy] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      subTab === PARAMETERS_TAB ||
      subTab === CATEGORIES_TAB ||
      subTab === SUPPORT_TAB
    ) {
      return;
    }
    const stillThere = categories.some((category) => category.id === subTab);
    if (!stillThere) setSubTab(PARAMETERS_TAB);
  }, [categories, subTab]);

  useEffect(() => {
    if (!menu) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenu(null);
      }
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

  function openCategoryMenu(
    event: ReactMouseEvent,
    categoryId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly || categories.length < 2) return;
    setMenu({
      x: event.clientX,
      y: event.clientY,
      targetCategoryId: categoryId,
      submenu: "root",
    });
  }

  function copyFrom(sourceCategoryId: string) {
    if (!menu || isCopying) return;
    const targetCategoryId = menu.targetCategoryId;
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
  const copySources = menu
    ? categories.filter((c) => c.id !== menu.targetCategoryId)
    : [];

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b bg-background px-4 pt-4 pb-3">
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
          active={subTab === PARAMETERS_TAB}
          onSelect={() => setSubTab(PARAMETERS_TAB)}
        >
          <SlidersHorizontal />
          Parámetros
        </StableTabButton>
        <StableTabButton
          active={subTab === CATEGORIES_TAB}
          onSelect={() => setSubTab(CATEGORIES_TAB)}
        >
          <Layers />
          Categorías
        </StableTabButton>
        {categories.map((category) => (
          <StableTabButton
            key={category.id}
            active={subTab === category.id}
            onSelect={() => setSubTab(category.id)}
            onContextMenu={(event) => openCategoryMenu(event, category.id)}
            title={
              readOnly || categories.length < 2
                ? undefined
                : "Clic derecho: copiar configuración"
            }
          >
            {category.name}
          </StableTabButton>
        ))}
        <StableTabButton
          active={subTab === SUPPORT_TAB}
          onSelect={() => setSubTab(SUPPORT_TAB)}
          className="ml-auto"
          title="Cómo se arma la llave según la cantidad de parejas"
        >
          <BookOpen />
          Soporte
        </StableTabButton>
      </div>
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-clip pt-4">
      {subTab === PARAMETERS_TAB ? (
        config ? (
          <TournamentConfigForm
            clubSlug={clubSlug}
            tournamentId={tournamentId}
            initial={config}
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
      ) : subTab === SUPPORT_TAB ? (
        <TorneosSoporteView />
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
            top: Math.min(menu.y, window.innerHeight - 160),
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
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                disabled={copySources.length === 0 || isCopying}
                onClick={() =>
                  setMenu({ ...menu, submenu: "copyFrom" })
                }
              >
                Copiar configuración desde…
              </button>
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
                Origen para {menuTarget.name}
              </p>
              {copySources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  disabled={isCopying}
                  onClick={() => copyFrom(source.id)}
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
