"use client";

import { useMemo, useState } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { SlotRuleGrid } from "./slot-rule-grid";
import {
  buildZonesSlotRules,
  zoneRuleGridCategories,
} from "./zones-match-rule-model";

export function ZonesMatchRulePanel({
  categories,
  pairs,
  config,
  courtCount,
}: {
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  courtCount: number;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    categories.map((category) => category.id),
  );

  const gridCategories = useMemo(
    () => zoneRuleGridCategories(categories),
    [categories],
  );

  const rules = useMemo(() => {
    if (!config) return [];
    return buildZonesSlotRules({
      categories,
      pairs,
      config,
      courtCount,
      selectedCategoryIds: selectedIds,
    });
  }, [categories, config, courtCount, pairs, selectedIds]);

  const collisionCount = useMemo(() => {
    if (!config) return 0;
    const used = new Map<string, Set<string>>();
    for (const categoryConfig of config.categories) {
      for (const zone of categoryConfig.zonesFixture?.zones ?? []) {
        for (const match of zone.matches) {
          if (!match.playDate || match.courtIndex == null || !match.startTime) {
            continue;
          }
          const key = `${match.playDate}:${match.courtIndex}:${match.startTime}`;
          const set = used.get(key) ?? new Set<string>();
          set.add(categoryConfig.categoryId);
          used.set(key, set);
        }
      }
    }
    return [...used.values()].filter((set) => set.size > 1).length;
  }, [config]);

  const matchCount = useMemo(
    () =>
      rules.reduce(
        (sum, day) =>
          sum +
          day.courts.reduce(
            (courtSum, court) =>
              courtSum +
              court.slots.filter((slot) => slot.status === "projected").length,
            0,
          ),
        0,
      ),
    [rules],
  );

  function toggleCategory(id: string, on: boolean) {
    setSelectedIds((current) => {
      if (on) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  }

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle>Regla de partidos</CardTitle>
        <CardAction>
          <AyudaButton
            title="Ayuda de regla de partidos"
            description="Cómo leer la grilla de zonas."
          >
            <p>
              Cada slot muestra horario, zona y número de partido (ej. A1). La
              bolita indica la categoría. Al pasar el mouse o hacer clic se ven
              las parejas.
            </p>
          </AyudaButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filtrar categorías"
        >
          {gridCategories.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
            >
              <Checkbox
                checked={selectedIds.includes(category.id)}
                onCheckedChange={(value) =>
                  toggleCategory(category.id, value === true)
                }
                aria-label={category.name}
              />
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
                aria-hidden
              />
              {category.abbreviation || category.name}
            </label>
          ))}
        </div>

        {!config || config.playDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Configurá los días de juego en Info / Parámetros para ver la regla.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {matchCount} partido{matchCount === 1 ? "" : "s"} visible
              {matchCount === 1 ? "" : "s"}
            </p>
            {collisionCount > 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Hay {collisionCount} cruce{collisionCount === 1 ? "" : "s"} de
                cancha y horario entre categorías. Entrá a cada categoría y
                tocá Actualizar para reubicar sin pisarse.
              </p>
            ) : null}
            <SlotRuleGrid
              mode="simulation"
              rules={rules}
              categories={gridCategories.filter((category) =>
                selectedIds.includes(category.id),
              )}
              phaseLegend={false}
              showMineCount={false}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
