"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate } from "@/lib/date";
import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import { buildZonesFixtureAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import type { MatchFormat } from "@/modules/tournaments/domain/config-schema";
import type {
  PairListItem,
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import type { ZonesFixturePersisted } from "@/modules/tournaments/domain/zones-fixture-schema";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import { distributeZoneSizes } from "@/modules/tournaments/domain/simulate-category-schedule";
import {
  emptyScoresForFormat,
  zoneMatchCount,
  zonePairings,
  zoneLabelFromIndex,
  type ZoneMatchKind,
} from "@/modules/tournaments/domain/zone-bracket";
import {
  ZoneCard,
  type ZoneDraft,
  type ZonePairOption,
} from "./zone-card";

function pairOptionLabel(pair: PairListItem): string {
  return formatAbbreviatedPairLabel(
    pair.player1.name,
    pair.player2?.name ?? null,
  );
}

function buildEmptyMatches(
  count: number,
  format: MatchFormat,
  prefix: string,
  kinds?: ZoneMatchKind[],
): ZoneDraft["matches"] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-m${i}`,
    playDate: "",
    startTime: "",
    courtIndex: null,
    pair1Id: null,
    pair2Id: null,
    kind: kinds?.[i],
    scores: emptyScoresForFormat(format),
  }));
}

function emptyKindsForZoneSize(size: number): ZoneMatchKind[] {
  return zonePairings(Array.from({ length: size }, (_, i) => i)).map(
    (p) => p.kind,
  );
}

function zonesFromFixture(
  fixture: ZonesFixturePersisted,
  format: MatchFormat,
  dayOpenByDate?: Record<string, string>,
): ZoneDraft[] {
  return fixture.zones.map((zone) => {
    const matches = [...zone.matches]
      .sort((a, b) => comparePlayDaySchedule(a, b, dayOpenByDate))
      .map((match, index) => ({
        id: `zone-${zone.label}-m${index}`,
        playDate: match.playDate ?? "",
        startTime: match.startTime ?? "",
        courtIndex: match.courtIndex,
        pair1Id: match.pair1Id,
        pair2Id: match.pair2Id,
        kind: match.kind,
        noRestGap: match.noRestGap ?? false,
        scores: emptyScoresForFormat(format),
      }));
    return {
      id: `zone-${zone.label}`,
      label: zone.label,
      pairIds: zone.pairIds,
      matches,
    };
  });
}

function zonesFromAssignedPairs(
  pairs: PairListItem[],
  format: MatchFormat,
): ZoneDraft[] {
  const byLabel = new Map<string, PairListItem[]>();
  for (const pair of pairs) {
    if (!pair.zoneLabel) continue;
    const list = byLabel.get(pair.zoneLabel) ?? [];
    list.push(pair);
    byLabel.set(pair.zoneLabel, list);
  }

  const labels = [...byLabel.keys()].sort((a, b) => a.localeCompare(b));
  return labels.map((label) => {
    const zonePairs = byLabel.get(label) ?? [];
    const pairIds = zonePairs.map((p) => p.id);
    const pairings = zonePairings(pairIds);
    const matchCount = zoneMatchCount(pairIds.length);
    return {
      id: `zone-${label}`,
      label,
      pairIds,
      matches:
        pairings.length > 0
          ? pairings.map((pairing, i) => ({
              id: `zone-${label}-m${i}`,
              playDate: "",
              startTime: "",
              courtIndex: null,
              pair1Id: pairing.pair1,
              pair2Id: pairing.pair2,
              kind: pairing.kind,
              scores: emptyScoresForFormat(format),
            }))
          : buildEmptyMatches(
              Math.max(matchCount, 3),
              format,
              `zone-${label}`,
              emptyKindsForZoneSize(Math.max(pairIds.length, 3)),
            ),
    };
  });
}

function draftZonesForCategory(
  pairCount: number,
  pairsPerZone: number,
  format: MatchFormat,
): ZoneDraft[] {
  const sizes = distributeZoneSizes(pairCount, pairsPerZone || 3);
  if (sizes.length === 0) {
    const size = pairsPerZone || 3;
    const kinds = emptyKindsForZoneSize(size);
    return [
      {
        id: "draft-zona-a",
        label: zoneLabelFromIndex(0),
        pairIds: [],
        matches: buildEmptyMatches(
          zoneMatchCount(size) || 3,
          format,
          "draft-a",
          kinds,
        ),
      },
    ];
  }

  return sizes.map((size, index) => ({
    id: `draft-${index}`,
    label: zoneLabelFromIndex(index),
    pairIds: [],
    matches: buildEmptyMatches(
      zoneMatchCount(size) || 3,
      format,
      `draft-${index}`,
      emptyKindsForZoneSize(size),
    ),
  }));
}

function buildZonesSnapshot(
  categoryPairs: PairListItem[],
  pairsPerZone: number,
  format: MatchFormat,
  fixture: ZonesFixturePersisted | null,
  dayOpenByDate?: Record<string, string>,
): ZoneDraft[] {
  if (fixture && fixture.zones.length > 0) {
    return zonesFromFixture(fixture, format, dayOpenByDate);
  }

  const assigned = zonesFromAssignedPairs(categoryPairs, format);
  if (assigned.length > 0) return assigned;

  const eligible = categoryPairs.filter((p) => Boolean(p.player2)).length;
  return draftZonesForCategory(
    Math.max(eligible, pairsPerZone),
    pairsPerZone,
    format,
  );
}

export function TournamentZonesPanel({
  clubSlug,
  tournamentId,
  categories,
  pairs,
  config,
  courtCount,
  initialCategoryId,
  lockCategory = false,
  reservations = [],
}: {
  clubSlug: string;
  tournamentId: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  courtCount: number;
  initialCategoryId?: string;
  /// Si true, no muestra el selector (la categoría viene del botón del torneo).
  lockCategory?: boolean;
  reservations?: SlotReservationItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(
    initialCategoryId && categories.some((c) => c.id === initialCategoryId)
      ? initialCategoryId
      : (categories[0]?.id ?? ""),
  );
  const [zonesByCategory, setZonesByCategory] = useState<
    Record<string, ZoneDraft[]>
  >({});
  const [rebuildToken, setRebuildToken] = useState(0);

  const activeCategoryId =
    lockCategory && initialCategoryId ? initialCategoryId : categoryId;

  const categoryConfig = config?.categories.find(
    (c) => c.categoryId === activeCategoryId,
  );
  const categoryMeta = categories.find((c) => c.id === activeCategoryId);
  const matchFormat: MatchFormat =
    categoryConfig?.phases.zones.matchFormat ?? "ONE_SET_6";
  const pairsPerZone = categoryConfig?.pairsPerZone ?? 3;
  const savedFixture = categoryConfig?.zonesFixture ?? null;

  const categoryPairs = useMemo(
    () =>
      pairs.filter(
        (p) =>
          p.categoryId === activeCategoryId && p.status !== "CANCELLED",
      ),
    [pairs, activeCategoryId],
  );

  const preferenceCount = useMemo(
    () =>
      reservations.filter((r) => r.categoryId === activeCategoryId).length,
    [reservations, activeCategoryId],
  );

  const pairsWithPreferences = useMemo(() => {
    const ids = new Set(
      reservations
        .filter((r) => r.categoryId === activeCategoryId)
        .map((r) => r.pairId),
    );
    return categoryPairs.filter((p) => ids.has(p.id)).length;
  }, [reservations, activeCategoryId, categoryPairs]);

  const pairOptions: ZonePairOption[] = useMemo(
    () =>
      categoryPairs.map((p) => ({
        id: p.id,
        label: pairOptionLabel(p),
      })),
    [categoryPairs],
  );

  const dayOptions = useMemo(() => {
    const zonesDates = categoryConfig?.phases.zones.playDates ?? [];
    const playDays = config?.playDays ?? [];
    return zonesDates.filter(Boolean).map((date) => {
      const dayIndex = playDays.findIndex((d) => d.date === date);
      const dayNum = dayIndex >= 0 ? dayIndex + 1 : null;
      return {
        value: date,
        label: dayNum
          ? `Día ${dayNum} · ${formatShortDate(date)}`
          : formatShortDate(date),
      };
    });
  }, [categoryConfig, config?.playDays]);

  const dayOpenByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const day of config?.playDays ?? []) {
      if (day.date) map[day.date] = day.startTime;
    }
    return map;
  }, [config?.playDays]);

  const slotMinutes = useMemo(() => {
    const duration = categoryConfig?.phases.zones.matchDurationMin ?? 0;
    const interval = categoryConfig?.intervalMin ?? 0;
    return Math.max(1, duration + interval);
  }, [categoryConfig]);

  const zones = useMemo(() => {
    if (!activeCategoryId) return [];
    if (zonesByCategory[activeCategoryId]) {
      return zonesByCategory[activeCategoryId];
    }
    return buildZonesSnapshot(
      categoryPairs,
      pairsPerZone,
      matchFormat,
      savedFixture,
      dayOpenByDate,
    );
  }, [
    activeCategoryId,
    zonesByCategory,
    categoryPairs,
    matchFormat,
    pairsPerZone,
    savedFixture,
    rebuildToken,
    dayOpenByDate,
  ]);

  function setZones(next: ZoneDraft[]) {
    if (!activeCategoryId) return;
    setZonesByCategory((prev) => ({ ...prev, [activeCategoryId]: next }));
  }

  function updateZone(zoneId: string, next: ZoneDraft) {
    setZones(zones.map((z) => (z.id === zoneId ? next : z)));
  }

  function handleActualizar() {
    if (!activeCategoryId) return;
    startTransition(async () => {
      const result = await buildZonesFixtureAction(
        clubSlug,
        tournamentId,
        activeCategoryId,
      );
      if (!result.ok) {
        toast.error("No se pudieron armar las zonas", {
          description: result.error,
        });
        return;
      }

      // Limpiar draft local para forzar lectura del fixture recién guardado.
      setZonesByCategory((prev) => {
        const copy = { ...prev };
        delete copy[activeCategoryId];
        return copy;
      });
      setRebuildToken((n) => n + 1);
      router.refresh();

      const withPartner = categoryPairs.filter((p) => p.player2).length;
      toast.success("Zonas armadas", {
        description: [
          `${result.zoneCount} zona(s) · ${result.matchCount} partido(s)`,
          `${withPartner} parejas con compañero`,
          `${pairsWithPreferences} con preferencias`,
          result.warnings[0],
        ]
          .filter(Boolean)
          .join(" · "),
      });
      if (result.warnings.length > 1) {
        for (const warning of result.warnings.slice(1, 4)) {
          toast.message(warning);
        }
      }
    });
  }

  const hasAssigned =
    Boolean(savedFixture?.zones.length) ||
    categoryPairs.some((p) => p.zoneLabel);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="size-4 text-muted-foreground" />
            Zonas{categoryMeta ? ` · ${categoryMeta.name}` : ""}
          </CardTitle>
          <CardDescription>
            Zonas de 3 (round-robin, pasan 2) o de 4 (cada pareja juega 2:
            apertura y luego ganador/ganador y perdedor/perdedor; pasan 3).{" "}
            <span className="font-medium text-foreground">Actualizar</span>{" "}
            asigna parejas y completa día, horario y cancha según preferencias.
            Después podés ajustar a mano.
            {!hasAssigned
              ? " Todavía no hay un armado guardado."
              : null}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleActualizar}
            disabled={isPending || !activeCategoryId}
          >
            <RefreshCw
              className={`size-4 ${isPending ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
          {!lockCategory && categories.length > 0 ? (
            <select
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Categoría de zonas"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Preferencias usadas: {pairsWithPreferences} pareja(s) ·{" "}
          {preferenceCount} celda(s). El armado intenta respetar todas las
          reglas; si algo no entra, la zona queda en ámbar (badge Revisar) para
          corregir a mano. Los cambios manuales en esta pantalla son locales
          hasta una próxima mejora de guardado.
        </p>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Creá una categoría para ver las zonas.
          </p>
        ) : (
          zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              pairOptions={pairOptions}
              matchFormat={matchFormat}
              courtCount={courtCount}
              dayOptions={dayOptions}
              dayOpenByDate={dayOpenByDate}
              slotMinutes={slotMinutes}
              onChange={(next) => updateZone(zone.id, next)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
