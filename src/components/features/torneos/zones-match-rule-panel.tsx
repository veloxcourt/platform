"use client";

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CALENDAR_PALETTE } from "@/modules/herramientas/domain/calendario-torneos";
import { buildMatchesRuleGrid } from "@/modules/tournaments/domain/court-day-slots";
import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  ZONE_MATCH_KIND_LABELS,
  formatZoneMatchCode,
  formatZoneMatchSlotCode,
  type ZoneMatchKind,
} from "@/modules/tournaments/domain/zone-bracket";
import {
  SlotRuleGrid,
  type SlotRuleGridCategory,
} from "./slot-rule-grid";

function categoryColor(
  category: TournamentCategoryItem,
  index: number,
): string {
  return category.color ?? CALENDAR_PALETTE[index % CALENDAR_PALETTE.length]!;
}

function pairSideLabel(
  pairId: string | null,
  pairById: Map<string, PairListItem>,
  kind: ZoneMatchKind,
  side: 1 | 2,
): string {
  if (pairId) {
    const pair = pairById.get(pairId);
    if (pair) {
      return formatAbbreviatedPairLabel(
        pair.player1.name,
        pair.player2?.name ?? null,
      );
    }
  }
  if (kind === "winners") return "Ganador";
  if (kind === "losers") return "Perdedor";
  return side === 1 ? "Pareja 1" : "Pareja 2";
}

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

  const gridCategories: SlotRuleGridCategory[] = useMemo(
    () =>
      categories.map((category, index) => ({
        id: category.id,
        name: category.name,
        abbreviation: category.abbreviation,
        color: categoryColor(category, index),
      })),
    [categories],
  );

  const rules = useMemo(() => {
    if (!config) return [];

    const slotMinutesByDate: Record<string, number> = {};
    let defaultSlotMinutes = 60;

    for (const categoryConfig of config.categories) {
      const minutes =
        categoryConfig.phases.zones.matchDurationMin +
        categoryConfig.intervalMin;
      defaultSlotMinutes = Math.max(defaultSlotMinutes, minutes);
      for (const date of categoryConfig.phases.zones.playDates) {
        if (!date) continue;
        slotMinutesByDate[date] = Math.max(
          slotMinutesByDate[date] ?? 0,
          minutes,
        );
      }
    }

    const selected = new Set(selectedIds);
    const zonesPlayDates = [
      ...new Set(
        config.categories
          .filter((categoryConfig) => selected.has(categoryConfig.categoryId))
          .flatMap((categoryConfig) =>
            categoryConfig.phases.zones.playDates.filter(Boolean),
          ),
      ),
    ];
    const abbreviationById = new Map(
      categories.map((category) => [category.id, category.abbreviation]),
    );
    const pairById = new Map(pairs.map((pair) => [pair.id, pair]));
    const matches = config.categories.flatMap((categoryConfig) =>
      (categoryConfig.zonesFixture?.zones ?? []).flatMap((zone) =>
        zone.matches
          .filter((match) => selected.has(categoryConfig.categoryId))
          .map((match) => ({
            categoryId: categoryConfig.categoryId,
            playDate: match.playDate ?? "",
            startTime: match.startTime ?? "",
            courtIndex: match.courtIndex,
            slotIndex: match.slotIndex,
            matchCode: formatZoneMatchSlotCode(zone.label, match.matchIndex + 1),
            pairLabel: formatZoneMatchCode(
              abbreviationById.get(categoryConfig.categoryId),
              zone.label,
              match.matchIndex + 1,
            ),
            pair1Label: pairSideLabel(
              match.pair1Id,
              pairById,
              match.kind,
              1,
            ),
            pair2Label: pairSideLabel(
              match.pair2Id,
              pairById,
              match.kind,
              2,
            ),
          })),
      ),
    );

    return buildMatchesRuleGrid({
      playDays: config.playDays,
      courtCount: config.courtCount || courtCount || 1,
      defaultSlotMinutes,
      slotMinutesByDate,
      matches,
      zonesPlayDates,
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
    <Card>
      <CardHeader>
        <CardTitle>Regla de partidos</CardTitle>
        <CardDescription>
          Cada slot muestra horario, zona y número de partido (ej. A1). La bolita
          indica la categoría. Al pasar el mouse o hacer clic se ven las
          parejas.
        </CardDescription>
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
