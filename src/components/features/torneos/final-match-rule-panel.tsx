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
import { CALENDAR_PALETTE } from "@/modules/herramientas/domain/calendario-torneos";
import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import {
  lastPlayDay,
  penultimatePlayDay,
} from "@/modules/tournaments/domain/build-intermediate-fixture";
import { buildMatchesRuleGrid } from "@/modules/tournaments/domain/court-day-slots";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
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

function shortRoundCode(roundLabel: string, matchNumber: number): string {
  const key = roundLabel.toLowerCase();
  if (key.includes("32")) return `32-${matchNumber}`;
  if (key.includes("16")) return `16-${matchNumber}`;
  if (key.startsWith("oct")) return `O${matchNumber}`;
  if (key.startsWith("cua")) return `C${matchNumber}`;
  if (key.startsWith("semi")) return `S${matchNumber}`;
  if (key.startsWith("fin")) return `F${matchNumber}`;
  return `${matchNumber}`;
}

export function FinalMatchRulePanel({
  categories,
  zoneCategories,
  pairs,
  config,
  courtCount,
}: {
  categories: TournamentCategoryItem[];
  zoneCategories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  courtCount: number;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    categories.map((category) => category.id),
  );
  const [showZoneMatches, setShowZoneMatches] = useState(false);
  const [showIntermediateMatches, setShowIntermediateMatches] = useState(false);

  const filterCategories =
    showZoneMatches || showIntermediateMatches ? zoneCategories : categories;

  const gridCategories: SlotRuleGridCategory[] = useMemo(
    () =>
      filterCategories.map((category) => {
        const colorIndex = zoneCategories.findIndex(
          (item) => item.id === category.id,
        );
        return {
          id: category.id,
          name: category.name,
          abbreviation: category.abbreviation,
          color: categoryColor(
            category,
            colorIndex >= 0 ? colorIndex : 0,
          ),
        };
      }),
    [filterCategories, zoneCategories],
  );

  const rules = useMemo(() => {
    if (!config) return [];

    const selected = new Set(selectedIds);
    const slotMinutesByDate: Record<string, number> = {};
    let defaultSlotMinutes = 60;
    const playDates = new Set<string>();
    const lastDay = lastPlayDay(config.playDays)?.date;
    const penultimate = penultimatePlayDay(config.playDays)?.date;

    for (const categoryConfig of config.categories) {
      const includeFinal =
        selected.has(categoryConfig.categoryId) &&
        categories.some((category) => category.id === categoryConfig.categoryId);
      const includeZones =
        showZoneMatches && selected.has(categoryConfig.categoryId);
      const includeIntermediate =
        showIntermediateMatches && selected.has(categoryConfig.categoryId);
      if (!includeFinal && !includeZones && !includeIntermediate) continue;

      const finalMinutes =
        categoryConfig.phases.final.matchDurationMin +
        categoryConfig.intervalMin;
      const knockoutMinutes =
        categoryConfig.phases.knockout.matchDurationMin +
        categoryConfig.intervalMin;
      const zoneMinutes =
        categoryConfig.phases.zones.matchDurationMin +
        categoryConfig.intervalMin;
      defaultSlotMinutes = Math.max(
        defaultSlotMinutes,
        includeFinal ? finalMinutes : 0,
        includeIntermediate ? knockoutMinutes : 0,
        includeZones ? zoneMinutes : 0,
      );

      if (includeFinal) {
        for (const date of categoryConfig.phases.final.playDates) {
          if (!date) continue;
          playDates.add(date);
          slotMinutesByDate[date] = Math.max(
            slotMinutesByDate[date] ?? 0,
            finalMinutes,
          );
        }
        for (const round of categoryConfig.finalFixture?.rounds ?? []) {
          for (const match of round.matches) {
            if (!match.playDate) continue;
            playDates.add(match.playDate);
            slotMinutesByDate[match.playDate] = Math.max(
              slotMinutesByDate[match.playDate] ?? 0,
              finalMinutes,
            );
          }
        }
      }

      if (includeIntermediate) {
        for (const date of categoryConfig.phases.knockout.playDates) {
          if (!date) continue;
          playDates.add(date);
          slotMinutesByDate[date] = Math.max(
            slotMinutesByDate[date] ?? 0,
            knockoutMinutes,
          );
        }
        for (const round of categoryConfig.intermediateFixture?.rounds ?? []) {
          for (const match of round.matches) {
            if (!match.playDate) continue;
            playDates.add(match.playDate);
            slotMinutesByDate[match.playDate] = Math.max(
              slotMinutesByDate[match.playDate] ?? 0,
              knockoutMinutes,
            );
          }
        }
      }

      if (includeZones) {
        for (const date of categoryConfig.phases.zones.playDates) {
          if (!date) continue;
          playDates.add(date);
          slotMinutesByDate[date] = Math.max(
            slotMinutesByDate[date] ?? 0,
            zoneMinutes,
          );
        }
        for (const zone of categoryConfig.zonesFixture?.zones ?? []) {
          for (const match of zone.matches) {
            if (!match.playDate) continue;
            playDates.add(match.playDate);
            slotMinutesByDate[match.playDate] = Math.max(
              slotMinutesByDate[match.playDate] ?? 0,
              zoneMinutes,
            );
          }
        }
      }
    }

    if (lastDay) {
      playDates.add(lastDay);
      slotMinutesByDate[lastDay] = Math.max(
        slotMinutesByDate[lastDay] ?? 0,
        defaultSlotMinutes,
      );
    }
    if (showIntermediateMatches && penultimate) {
      playDates.add(penultimate);
      slotMinutesByDate[penultimate] = Math.max(
        slotMinutesByDate[penultimate] ?? 0,
        defaultSlotMinutes,
      );
    }

    const abbreviationById = new Map(
      zoneCategories.map((category) => [category.id, category.abbreviation]),
    );
    const pairById = new Map(pairs.map((pair) => [pair.id, pair]));
    const intermediateMatches = showIntermediateMatches
      ? config.categories.flatMap((categoryConfig) =>
          (categoryConfig.intermediateFixture?.rounds ?? []).flatMap((round) =>
            round.matches
              .filter((match) => selected.has(categoryConfig.categoryId))
              .map((match) => {
                const code = shortRoundCode(round.label, match.matchIndex + 1);
                const abbr =
                  abbreviationById.get(categoryConfig.categoryId)?.trim() || "?";
                return {
                  categoryId: categoryConfig.categoryId,
                  playDate: match.playDate ?? "",
                  startTime: match.startTime ?? "",
                  courtIndex: match.courtIndex,
                  slotIndex: match.slotIndex,
                  matchCode: code,
                  pairLabel: `${abbr}-${code}`,
                  pair1Label: match.left,
                  pair2Label: match.right,
                  projectedPhase: "knockout" as const,
                };
              }),
          ),
        )
      : [];
    const zoneMatches = showZoneMatches
      ? config.categories
          .filter((categoryConfig) => selected.has(categoryConfig.categoryId))
          .flatMap((categoryConfig) =>
            (categoryConfig.zonesFixture?.zones ?? []).flatMap((zone) =>
              zone.matches.map((match) => ({
                categoryId: categoryConfig.categoryId,
                playDate: match.playDate ?? "",
                startTime: match.startTime ?? "",
                courtIndex: match.courtIndex,
                slotIndex: match.slotIndex,
                matchCode: formatZoneMatchSlotCode(
                  zone.label,
                  match.matchIndex + 1,
                ),
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
                projectedPhase: "zones" as const,
              })),
            ),
          )
      : [];
    const finalMatches = config.categories.flatMap((categoryConfig) =>
      (categoryConfig.finalFixture?.rounds ?? []).flatMap((round) =>
        round.matches
          .filter(
            (match) =>
              selected.has(categoryConfig.categoryId) &&
              categories.some(
                (category) => category.id === categoryConfig.categoryId,
              ),
          )
          .map((match) => {
            const code = shortRoundCode(round.label, match.matchIndex + 1);
            const abbr =
              abbreviationById.get(categoryConfig.categoryId)?.trim() || "?";
            return {
              categoryId: categoryConfig.categoryId,
              playDate: match.playDate ?? "",
              startTime: match.startTime ?? "",
              courtIndex: match.courtIndex,
              slotIndex: match.slotIndex,
              matchCode: code,
              pairLabel: `${abbr}-${code}`,
              pair1Label: match.left,
              pair2Label: match.right,
              projectedPhase: "final" as const,
            };
          }),
      ),
    );
    const matches = [...zoneMatches, ...intermediateMatches, ...finalMatches];

    return buildMatchesRuleGrid({
      playDays: config.playDays,
      courtCount: config.courtCount || courtCount || 1,
      defaultSlotMinutes,
      slotMinutesByDate,
      matches,
      zonesPlayDates: [...playDates],
    });
  }, [
    categories,
    config,
    courtCount,
    pairs,
    selectedIds,
    showIntermediateMatches,
    showZoneMatches,
    zoneCategories,
  ]);

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

  function toggleIncludePrevious(
    kind: "zones" | "intermediate",
    on: boolean,
  ) {
    if (kind === "zones") setShowZoneMatches(on);
    else setShowIntermediateMatches(on);
    if (!on) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const category of zoneCategories) next.add(category.id);
      return [...next];
    });
  }

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle>Regla de partidos</CardTitle>
        <CardAction>
          <AyudaButton
            title="Ayuda de regla de partidos"
            description="Cómo leer la grilla de fase final."
          >
            <p>
              Días y canchas de la fase final. Después de{" "}
              <span className="font-medium text-foreground">Actualizar</span> se
              pintan los partidos en el último día.
            </p>
            <p>
              Incluir fases anteriores agrega los que anteceden. Al pasar el
              mouse o hacer clic se ven los cruces.
            </p>
          </AyudaButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <Checkbox
                checked={showZoneMatches}
                onCheckedChange={(value) =>
                  toggleIncludePrevious("zones", value === true)
                }
                aria-label="Incluir partidos de Zona"
              />
              Incluir partidos de Zona
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <Checkbox
                checked={showIntermediateMatches}
                onCheckedChange={(value) =>
                  toggleIncludePrevious("intermediate", value === true)
                }
                aria-label="Incluir fase intermedia"
              />
              Incluir fase intermedia
            </label>
          </div>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna categoría tiene fase final.
          </p>
        ) : !config || config.playDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Configurá los días de juego en Info / Parámetros para ver la regla.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {matchCount} partido{matchCount === 1 ? "" : "s"} visible
              {matchCount === 1 ? "" : "s"}
            </p>
            <SlotRuleGrid
              mode="simulation"
              rules={rules}
              categories={gridCategories.filter((category) =>
                selectedIds.includes(category.id),
              )}
              phaseLegend={showZoneMatches || showIntermediateMatches}
              showMineCount={false}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
