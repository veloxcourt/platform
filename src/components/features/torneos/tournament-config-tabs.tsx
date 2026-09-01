"use client";

import { useEffect, useState } from "react";
import { Layers, SlidersHorizontal } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { StableTabButton } from "@/components/ui/stable-tab-button";
import { TournamentCategoriesPanel } from "./tournament-categories-panel";
import { TournamentConfigForm } from "./tournament-config-form";

const PARAMETERS_TAB = "parametros" as const;
const CATEGORIES_TAB = "categorias" as const;

type ConfigSubTab =
  | typeof PARAMETERS_TAB
  | typeof CATEGORIES_TAB
  | string;

export function TournamentConfigTabs({
  clubSlug,
  tournamentId,
  categories,
  levels,
  config,
  courtCount,
}: {
  clubSlug: string;
  tournamentId: string;
  categories: TournamentCategoryItem[];
  levels: string[];
  config: TournamentConfig | null;
  courtCount: number;
}) {
  const [subTab, setSubTab] = useState<ConfigSubTab>(PARAMETERS_TAB);

  useEffect(() => {
    if (subTab === PARAMETERS_TAB || subTab === CATEGORIES_TAB) return;
    const stillThere = categories.some((category) => category.id === subTab);
    if (!stillThere) setSubTab(PARAMETERS_TAB);
  }, [categories, subTab]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
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
          >
            {category.name}
          </StableTabButton>
        ))}
      </div>

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
          levels={levels}
          config={config}
          courtCount={courtCount}
          showInscriptionStats={false}
        />
      ) : config ? (
        <TournamentConfigForm
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
  );
}
