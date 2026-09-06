"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
import { formatShortDate, formatWeekday } from "@/lib/date";
import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import {
  buildZonesFixtureAction,
  saveZonesFixtureDraftAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import {
  MATCH_FORMAT_LABELS,
  type MatchFormat,
} from "@/modules/tournaments/domain/config-schema";
import type {
  PairListItem,
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { mergeScoreMaps } from "@/modules/tournaments/domain/match-scores";
import type {
  ZonesFixtureDraftInput,
  ZonesFixturePersisted,
} from "@/modules/tournaments/domain/zones-fixture-schema";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import { distributeZoneSizes } from "@/modules/tournaments/domain/simulate-category-schedule";
import {
  emptyScoresForFormat,
  resultColumnsForFormat,
  zoneMatchCount,
  zonePairings,
  zoneLabelFromIndex,
  zonesStructureIsStale,
  ZONE_MATCH_KIND_LABELS,
  type ZoneMatchKind,
} from "@/modules/tournaments/domain/zone-bracket";
import {
  inconsistentPairIdsInZone,
  inconsistentZoneIds,
  pairZoneLabelsById,
  replacePairInZone,
} from "@/modules/tournaments/domain/replace-zone-pair";
import {
  collectExternalCourtSlots,
  labelsForCourtSlot,
  scheduleConflictMatchIds,
  scheduleConflictZoneIds,
} from "@/modules/tournaments/domain/zone-schedule-conflicts";
import { ChangeZonePairDialog } from "./change-zone-pair-dialog";
import { ChangeZoneTimeDialog } from "./change-zone-time-dialog";
import { useAdjustablePlayDays } from "./use-adjustable-play-days";
import {
  buildZonesSlotRules,
  zoneRuleGridCategories,
} from "./zones-match-rule-model";
import {
  ZoneCard,
  type ZoneDraft,
  type ZonePairOption,
} from "./zone-card";
import { ActualizarConfirmButton } from "./actualizar-confirm-button";
import { FixtureEditModeSelect } from "./fixture-edit-mode-select";
import {
  useFixtureEditMode,
  useRegisterFixturePersistFlush,
} from "./fixture-edit-mode-context";
import { buildActualizarConfirmCopy } from "@/modules/tournaments/domain/fixture-edit-mode";
import { isPairEligibleForZones } from "@/modules/tournaments/domain/pair-confirmation";
import { ZonesCardsPdfMenu } from "./zones-cards-pdf-menu";
import type { ZonesCardsPdfInput } from "./zones-cards-pdf";
import { useTournamentReadOnly } from "./tournament-mode-context";

function pairOptionLabel(pair: PairListItem): string {
  return formatAbbreviatedPairLabel(
    pair.player1.name,
    pair.player2?.name ?? null,
  );
}

function pairEligibleForZones(pair: PairListItem) {
  return isPairEligibleForZones({
    status: pair.status,
    hasPartner: Boolean(pair.player2),
    player1Confirmed: pair.player1Confirmed,
    player2Confirmed: pair.player2Confirmed,
  });
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
        ruleBreaks: match.ruleBreaks ?? [],
        scores: mergeScoreMaps(emptyScoresForFormat(format), match.scores),
      }));
    return {
      id: `zone-${zone.label}`,
      label: zone.label,
      pairIds: zone.pairIds,
      matches,
      tieBreaks: zone.tieBreaks,
    };
  });
}

function zonesFromAssignedPairs(
  pairs: PairListItem[],
  format: MatchFormat,
): ZoneDraft[] {
  const byLabel = new Map<string, PairListItem[]>();
  for (const pair of pairs) {
    if (!pair.zoneLabel || !pairEligibleForZones(pair)) continue;
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

function zonesDraftPayload(zones: ZoneDraft[]): ZonesFixtureDraftInput {
  return {
    zones: zones.map((zone) => ({
      label: zone.label,
      pairIds: zone.pairIds,
      tieBreaks: zone.tieBreaks,
      matches: zone.matches.map((match) => ({
        kind: match.kind,
        playDate: match.playDate,
        startTime: match.startTime,
        courtIndex: match.courtIndex,
        pair1Id: match.pair1Id,
        pair2Id: match.pair2Id,
        noRestGap: match.noRestGap,
        ruleBreaks: match.ruleBreaks,
        scores: match.scores,
      })),
    })),
  };
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

  const eligible = categoryPairs.filter(pairEligibleForZones).length;
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
  reservations = [],
}: {
  clubSlug: string;
  tournamentId: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  courtCount: number;
  /// Categoría activa: la elige el padre (sub-pestañas o ruta).
  initialCategoryId?: string;
  reservations?: SlotReservationItem[];
}) {
  const router = useRouter();
  const readOnly = useTournamentReadOnly();
  const [isPending, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{
    categoryId: string;
    draft: ZonesFixtureDraftInput;
  } | null>(null);
  const flushZonesSaveRef = useRef<() => Promise<unknown>>(async () => ({
    ok: true,
  }));
  useRegisterFixturePersistFlush(() => flushZonesSaveRef.current());
  const [zonesByCategory, setZonesByCategory] = useState<
    Record<string, ZoneDraft[]>
  >({});
  const [rebuildToken, setRebuildToken] = useState(0);
  const [lastEditedZoneId, setLastEditedZoneId] = useState<string | null>(
    null,
  );
  const [lastEditedMatchId, setLastEditedMatchId] = useState<string | null>(
    null,
  );
  const [changePairRequest, setChangePairRequest] = useState<{
    zoneId: string;
    pairId: string;
  } | null>(null);
  const [changeScheduleRequest, setChangeScheduleRequest] = useState<{
    zoneId: string;
    matchId: string;
  } | null>(null);

  const activeCategoryId =
    initialCategoryId && categories.some((c) => c.id === initialCategoryId)
      ? initialCategoryId
      : (categories[0]?.id ?? "");
  const { isManual, scheduleLocked, modes } = useFixtureEditMode(
    activeCategoryId,
    "zones",
  );

  const categoryConfig = config?.categories.find(
    (c) => c.categoryId === activeCategoryId,
  );
  const categoryMeta = categories.find((c) => c.id === activeCategoryId);
  const matchFormat: MatchFormat =
    categoryConfig?.phases.zones.matchFormat ?? "ONE_SET_6";
  const pairsPerZone = categoryConfig?.pairsPerZone ?? 3;
  const zone4Advancers = categoryConfig?.zone4Advancers === 2 ? 2 : 3;
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
          ? `D${dayNum} · ${formatWeekday(date)}`
          : formatWeekday(date),
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
  const {
    playDays: livePlayDays,
    adjustPlayDay,
    canAdjustPlayDay,
    adjustPending,
  } = useAdjustablePlayDays({
    clubSlug,
    tournamentId,
    playDays: config?.playDays ?? [],
    slotMinutesForDate: () => slotMinutes,
    readOnly,
  });
  const liveConfig = useMemo(
    () => (config ? { ...config, playDays: livePlayDays } : null),
    [config, livePlayDays],
  );

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

  const externalCourtSlots = useMemo(
    () =>
      collectExternalCourtSlots({
        categories: config?.categories ?? [],
        activeCategoryId,
        localZonesByCategory: zonesByCategory,
      }),
    [config?.categories, activeCategoryId, zonesByCategory],
  );

  const conflictZoneIds = useMemo(
    () => inconsistentZoneIds(zones, lastEditedZoneId),
    [zones, lastEditedZoneId],
  );
  const scheduleConflicts = useMemo(
    () => scheduleConflictMatchIds(zones, externalCourtSlots),
    [zones, externalCourtSlots],
  );
  const scheduleConflictZones = useMemo(
    () =>
      scheduleConflictZoneIds(
        zones,
        scheduleConflicts.all,
        lastEditedMatchId,
        scheduleConflicts.externalCourt,
      ),
    [zones, scheduleConflicts, lastEditedMatchId],
  );

  const cardsPdfInput = useMemo((): ZonesCardsPdfInput => {
    const columns = resultColumnsForFormat(matchFormat);
    const scoreGroups: ZonesCardsPdfInput["scoreGroups"] = [];
    for (const col of columns) {
      const group = col.group ?? col.label;
      const last = scoreGroups[scoreGroups.length - 1];
      if (last && last.group === group) last.count += 1;
      else scoreGroups.push({ group, count: 1 });
    }
    const kindOrder: Record<string, number> = {
      opening: 0,
      round_robin: 1,
      winners: 2,
      losers: 3,
    };
    const start = config?.startDate;
    const end = config?.endDate;
    const dateRange = start
      ? end && end !== start
        ? `${formatShortDate(start)} – ${formatShortDate(end)}`
        : formatShortDate(start)
      : "";
    return {
      tournamentName: config?.tournamentName ?? "",
      categoryName: categoryMeta?.name ?? "",
      dateRange,
      formatLabel: MATCH_FORMAT_LABELS[matchFormat],
      scoreGroups,
      zones: zones.map((zone) => {
        const hasPairInconsistency = conflictZoneIds.has(zone.id);
        const hasScheduleConflict = scheduleConflictZones.has(zone.id);
        const hasUnscheduled = zone.matches.some(
          (match) => !match.playDate.trim() || !match.startTime.trim(),
        );
        const hasNoRest = zone.matches.some((match) => match.noRestGap);
        const informedBreaks = zone.matches.flatMap(
          (match) => match.ruleBreaks ?? [],
        );
        const extras = [
          hasNoRest ? "sin descanso en algún partido" : null,
          informedBreaks.includes("day_pref")
            ? "pref. de día no respetada"
            : null,
          informedBreaks.includes("cell_pref")
            ? "pref. de horario no respetada"
            : null,
          hasUnscheduled ? "horario incompleto" : null,
        ].filter(Boolean);
        const needsReview = hasUnscheduled || hasNoRest;
        const tone = hasPairInconsistency || hasScheduleConflict
          ? "conflict"
          : needsReview
            ? "review"
            : "ok";
        const badges = [
          hasScheduleConflict ? "Choque" : null,
          hasPairInconsistency ? "Pareja duplicada" : null,
          needsReview ? "Revisar" : null,
        ].filter((item): item is string => Boolean(item));
        const tableMatches = [...zone.matches].sort((a, b) => {
          const kindCmp =
            (kindOrder[a.kind ?? "round_robin"] ?? 1) -
            (kindOrder[b.kind ?? "round_robin"] ?? 1);
          if (kindCmp !== 0) return kindCmp;
          return comparePlayDaySchedule(a, b, dayOpenByDate);
        });
        return {
          label: zone.label,
          subtitle: [
            `${zone.matches.length} partido${zone.matches.length === 1 ? "" : "s"} · ${MATCH_FORMAT_LABELS[matchFormat]}`,
            ...extras,
          ].join(" · "),
          pairLabels: zone.pairIds.map(
            (id) => pairOptions.find((option) => option.id === id)?.label ?? "—",
          ),
          badges,
          tone,
          matches: tableMatches.map((match, index) => {
            const courtBusy = scheduleConflicts.court.has(match.id);
            const pairBusy = scheduleConflicts.pair.has(match.id);
            const highlight = courtBusy || pairBusy;
            const lacksSchedule =
              !match.playDate.trim() || !match.startTime.trim();
            const note = highlight
              ? courtBusy
                ? "Cancha ocupada"
                : "Pareja ocupada"
              : match.noRestGap
                ? "Sin descanso"
                : lacksSchedule
                  ? "Sin horario"
                  : match.kind &&
                      (match.kind === "winners" ||
                        match.kind === "losers" ||
                        match.kind === "opening")
                    ? ZONE_MATCH_KIND_LABELS[match.kind]
                    : undefined;
            return {
              number: index + 1,
              day:
                dayOptions.find((option) => option.value === match.playDate)
                  ?.label ?? (match.playDate || "—"),
              time: match.startTime || "—",
              court:
                match.courtIndex == null ? "—" : String(match.courtIndex + 1),
              pair1:
                pairOptions.find((option) => option.id === match.pair1Id)
                  ?.label ?? "—",
              pair2:
                pairOptions.find((option) => option.id === match.pair2Id)
                  ?.label ?? "—",
              scores: columns.map((col) => match.scores[col.key] ?? ""),
              note,
              highlight,
              review: !highlight && (match.noRestGap || lacksSchedule),
            };
          }),
        };
      }),
    };
  }, [
    matchFormat,
    config?.tournamentName,
    config?.startDate,
    config?.endDate,
    categoryMeta?.name,
    zones,
    conflictZoneIds,
    scheduleConflictZones,
    scheduleConflicts,
    pairOptions,
    dayOptions,
    dayOpenByDate,
  ]);

  const pairLabelsById = useMemo(() => pairZoneLabelsById(zones), [zones]);

  const changePairZone = changePairRequest
    ? zones.find((zone) => zone.id === changePairRequest.zoneId)
    : undefined;
  const changeScheduleZone = changeScheduleRequest
    ? zones.find((zone) => zone.id === changeScheduleRequest.zoneId)
    : undefined;
  const changeScheduleMatch = changeScheduleZone?.matches.find(
    (match) => match.id === changeScheduleRequest?.matchId,
  );
  const timePickerRules = useMemo(() => {
    if (!liveConfig || !activeCategoryId) return [];
    return buildZonesSlotRules({
      categories,
      pairs,
      config: liveConfig,
      courtCount,
      liveZonesByCategory: { [activeCategoryId]: zones },
      excludeMatchId: changeScheduleMatch?.id,
    });
  }, [
    activeCategoryId,
    categories,
    changeScheduleMatch?.id,
    liveConfig,
    courtCount,
    pairs,
    zones,
  ]);
  const timePickerCategories = useMemo(
    () => zoneRuleGridCategories(categories),
    [categories],
  );
  const changePairOptions = useMemo(
    () =>
      categoryPairs
        .filter(pairEligibleForZones)
        .map((pair) => ({
          id: pair.id,
          label: pairOptionLabel(pair),
          zoneLabels: pairLabelsById.get(pair.id) ?? [],
        })),
    [categoryPairs, pairLabelsById],
  );

  useEffect(() => {
    setLastEditedZoneId(null);
    setLastEditedMatchId(null);
    setChangePairRequest(null);
    setChangeScheduleRequest(null);
  }, [activeCategoryId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending) {
        void saveZonesFixtureDraftAction(
          clubSlug,
          tournamentId,
          pending.categoryId,
          pending.draft,
        );
      }
    };
  }, [clubSlug, tournamentId]);

  async function writeZonesDraft(pending: {
    categoryId: string;
    draft: ZonesFixtureDraftInput;
  }) {
    const result = await saveZonesFixtureDraftAction(
      clubSlug,
      tournamentId,
      pending.categoryId,
      pending.draft,
    );
    if (!result.ok) {
      toast.error("No se pudo guardar el resultado", {
        description: result.error,
      });
    }
    return result;
  }

  async function flushZonesSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return { ok: true as const };
    pendingSaveRef.current = null;
    return writeZonesDraft(pending);
  }
  flushZonesSaveRef.current = flushZonesSave;

  function persistZones(next: ZoneDraft[]) {
    if (readOnly || !activeCategoryId) return;
    const draft = zonesDraftPayload(next);
    const previous = pendingSaveRef.current;
    if (previous && previous.categoryId !== activeCategoryId) {
      void writeZonesDraft(previous);
    }
    pendingSaveRef.current = { categoryId: activeCategoryId, draft };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void flushZonesSave();
    }, 600);
  }

  function setZones(next: ZoneDraft[]) {
    if (!activeCategoryId) return;
    setZonesByCategory((prev) => ({ ...prev, [activeCategoryId]: next }));
  }

  function toastConflictZones(labels: string[], kind: "pair" | "schedule") {
    if (labels.length === 0) return;
    toast.message(
      kind === "pair"
        ? "Hay zonas con la misma pareja"
        : "Hay zonas con choque de horario o cancha",
      {
        description:
          labels.length === 1
            ? `${labels[0]} quedó marcada en rojo.`
            : `${labels.join(", ")} quedaron marcadas en rojo.`,
      },
    );
  }

  function applyZones(
    nextZones: ZoneDraft[],
    edited: { zoneId: string; matchId?: string },
  ) {
    setLastEditedZoneId(edited.zoneId);
    setLastEditedMatchId(edited.matchId ?? null);
    setZones(nextZones);
    persistZones(nextZones);
  }

  function updateZone(
    zoneId: string,
    next: ZoneDraft,
    meta?: { matchId?: string },
  ) {
    const nextZones = zones.map((z) => (z.id === zoneId ? next : z));
    applyZones(nextZones, { zoneId, matchId: meta?.matchId });
    if (meta?.matchId) {
      const conflicts = scheduleConflictMatchIds(
        nextZones,
        externalCourtSlots,
      );
      const editedMatch = nextZones
        .flatMap((zone) => zone.matches)
        .find((match) => match.id === meta.matchId);
      const otherCategoryLabels = editedMatch
        ? labelsForCourtSlot(
            externalCourtSlots,
            editedMatch.playDate,
            editedMatch.startTime,
            editedMatch.courtIndex,
          )
        : [];
      if (otherCategoryLabels.length > 0) {
        toast.message("Hay choque con otra categoría", {
          description: otherCategoryLabels.join(", "),
        });
      }
      toastConflictZones(
        nextZones
          .filter((zone) =>
            scheduleConflictZoneIds(
              nextZones,
              conflicts.all,
              meta.matchId,
              conflicts.externalCourt,
            ).has(zone.id),
          )
          .map((zone) => zone.label)
          .filter((label) => !otherCategoryLabels.includes(label)),
        "schedule",
      );
    }
  }

  function patchMatch(
    zoneId: string,
    matchId: string,
    patch: Partial<ZoneDraft["matches"][number]>,
  ) {
    const current = zones.find((zone) => zone.id === zoneId);
    if (!current) return;
    const nextMatches = current.matches.map((match) =>
      match.id === matchId ? { ...match, ...patch } : match,
    );
    const touchesSchedule =
      "playDate" in patch ||
      "startTime" in patch ||
      "pair1Id" in patch ||
      "pair2Id" in patch;
    updateZone(
      zoneId,
      {
        ...current,
        matches: touchesSchedule
          ? [...nextMatches].sort((a, b) =>
              comparePlayDaySchedule(a, b, dayOpenByDate),
            )
          : nextMatches,
      },
      { matchId },
    );
  }

  function replaceZonePair(zoneId: string, fromPairId: string, toPairId: string) {
    const current = zones.find((zone) => zone.id === zoneId);
    if (!current) return;
    const replaced = replacePairInZone(current, fromPairId, toPairId);
    if (replaced === current) return;
    const nextZones = zones.map((zone) =>
      zone.id === zoneId ? replaced : zone,
    );
    applyZones(nextZones, { zoneId });
    toastConflictZones(
      nextZones
        .filter((zone) => inconsistentZoneIds(nextZones, zoneId).has(zone.id))
        .map((zone) => zone.label),
      "pair",
    );
  }

  function handleActualizar() {
    if (!activeCategoryId) return;
    startTransition(async () => {
      await flushZonesSave();
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
      setLastEditedZoneId(null);
      setLastEditedMatchId(null);
      setChangePairRequest(null);
      setChangeScheduleRequest(null);
      setRebuildToken((n) => n + 1);
      router.refresh();

      const withPartner = categoryPairs.filter(pairEligibleForZones).length;
      toast.success("Zonas armadas", {
        description: [
          `${result.zoneCount} zona(s) · ${result.matchCount} partido(s)`,
          `${withPartner} parejas Parcial o Confirmado`,
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
  const eligiblePairCount = categoryPairs.filter(pairEligibleForZones).length;
  const structureStale =
    hasAssigned &&
    zonesStructureIsStale({
      pairCount: eligiblePairCount,
      pairsPerZone,
      zoneSizes: (savedFixture?.zones ?? zones).map((zone) =>
        "pairIds" in zone ? zone.pairIds.length : 0,
      ),
    });
  const zoneConfirm = buildActualizarConfirmCopy({
    phase: "zones",
    scope: "category",
    modes,
    categories: categories.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    categoryId: activeCategoryId,
  });

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle className="flex items-center gap-2">
          <Grid3x3 className="size-4 text-muted-foreground" />
          Zonas{categoryMeta ? ` · ${categoryMeta.name}` : ""}
          <span className="text-sm font-normal text-muted-foreground">
            {categoryPairs.length} pareja
            {categoryPairs.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
        <CardAction>
          <div className="flex flex-wrap items-center justify-end gap-2">
          {!readOnly && activeCategoryId ? (
            <>
              <FixtureEditModeSelect
                clubSlug={clubSlug}
                tournamentId={tournamentId}
                categoryId={activeCategoryId}
                categoryName={categoryMeta?.name}
                phase="zones"
              />
              <ActualizarConfirmButton
                pending={isPending}
                disabled={!activeCategoryId}
                heading={
                  structureStale
                    ? "Las parejas ya no coinciden con estas tarjetas"
                    : hasAssigned
                      ? "Vuelve a armar las zonas de esta categoría"
                      : "Arma las zonas de esta categoría"
                }
                effects={zoneConfirm.affects}
                note={
                  isManual
                    ? structureStale
                      ? "Rearma las tarjetas y seguís en Manual para seguir editando."
                      : "En Manual también podés rehacer las tarjetas. Después seguís editando a mano."
                    : hasAssigned
                      ? "Pisa los ajustes de esta categoría. Las otras no cambian."
                      : "Completa día, horario y cancha según preferencias."
                }
                confirm={zoneConfirm}
                onConfirm={handleActualizar}
              />
            </>
          ) : null}
          <ZonesCardsPdfMenu input={cardsPdfInput} />
          <AyudaButton
            title="Ayuda de zonas"
            description="Cómo se arman las tarjetas y cómo se editan en esta pantalla."
          >
            <p>
              Zonas de 3 (round-robin, pasan 2) o de 4 (cada pareja juega 2:
              apertura y luego ganador/ganador y perdedor/perdedor; pasan{" "}
              {zone4Advancers}
              {zone4Advancers === 2 ? " · APA" : " · FAP"}).
            </p>
            <p>
              <span className="font-medium text-foreground">Actualizar</span>{" "}
              arma las tarjetas. En Modo Manual podés rehacerlas si cambian las
              parejas y seguir editando. Los resultados se guardan solos.
              {!hasAssigned ? " Todavía no hay un armado guardado." : null}
            </p>
            <p>
              Preferencias usadas: {pairsWithPreferences} pareja(s) ·{" "}
              {preferenceCount} celda(s). El armado intenta respetar todas las
              reglas; si algo no entra, la zona queda en ámbar (badge Revisar).
            </p>
            <p>
              En Modo Manual los cambios se guardan. Tocá día, horario o
              cancha para elegir las tres cosas juntas en la regla de slots.
              En tablet o celular, tocá la pareja; con mouse, clic derecho.
              Las otras zonas o categorías con la misma pareja o un choque de
              cancha/horario se marcan en rojo.
            </p>
          </AyudaButton>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {structureStale ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Hay {eligiblePairCount} pareja{eligiblePairCount === 1 ? "" : "s"}{" "}
            Parcial o Confirmado y las tarjetas actuales ya no coinciden. Tocá{" "}
            <span className="font-medium">Actualizar</span> para rehacer las
            zonas
            {isManual
              ? " y seguir editando en Modo Manual"
              : ""}
            .
          </p>
        ) : null}
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Creá una categoría para ver las zonas.
          </p>
        ) : (
          zones.map((zone) => {
            const hasPairInconsistency = conflictZoneIds.has(zone.id);
            const hasScheduleConflict = scheduleConflictZones.has(zone.id);
            const inconsistentPairIds = hasPairInconsistency
              ? inconsistentPairIdsInZone(zone, zones)
              : undefined;
            return (
            <ZoneCard
              key={zone.id}
              zone={zone}
              pairOptions={pairOptions}
              matchFormat={matchFormat}
              courtCount={courtCount}
              dayOptions={dayOptions}
              dayOpenByDate={dayOpenByDate}
              slotMinutes={slotMinutes}
              readOnly={readOnly}
              scheduleLocked={scheduleLocked}
              canManualEdit={isManual && !readOnly}
              zone4Advancers={zone4Advancers}
              hasPairInconsistency={hasPairInconsistency}
              hasScheduleConflict={hasScheduleConflict}
              inconsistentPairIds={inconsistentPairIds}
              courtConflictMatchIds={scheduleConflicts.court}
              pairTimeConflictMatchIds={scheduleConflicts.pair}
              onChange={(next, meta) => updateZone(zone.id, next, meta)}
              onChangePairRequest={(pairId) =>
                setChangePairRequest({ zoneId: zone.id, pairId })
              }
              onChangeScheduleRequest={(matchId) =>
                setChangeScheduleRequest({
                  zoneId: zone.id,
                  matchId,
                })
              }
            />
            );
          })
        )}
        <ChangeZonePairDialog
          open={Boolean(changePairRequest && changePairZone)}
          onOpenChange={(open) => {
            if (!open) setChangePairRequest(null);
          }}
          zoneLabel={changePairZone?.label ?? ""}
          currentPairId={changePairRequest?.pairId ?? ""}
          currentPairLabel={
            pairOptions.find((option) => option.id === changePairRequest?.pairId)
              ?.label ?? "esta pareja"
          }
          zonePairIds={changePairZone?.pairIds ?? []}
          options={changePairOptions}
          onSelect={(toPairId) => {
            if (!changePairRequest) return;
            replaceZonePair(
              changePairRequest.zoneId,
              changePairRequest.pairId,
              toPairId,
            );
            setChangePairRequest(null);
          }}
        />
        <ChangeZoneTimeDialog
          open={Boolean(changeScheduleRequest && changeScheduleMatch)}
          onOpenChange={(open) => {
            if (!open) setChangeScheduleRequest(null);
          }}
          zoneLabel={changeScheduleZone?.label ?? "esta zona"}
          rules={timePickerRules}
          categories={timePickerCategories}
          onAdjustPlayDay={adjustPlayDay}
          canAdjustPlayDay={canAdjustPlayDay}
          adjustDisabled={readOnly || adjustPending}
          selectedSlot={
            changeScheduleMatch
              ? {
                  playDate: changeScheduleMatch.playDate,
                  startTime: changeScheduleMatch.startTime,
                  courtIndex: changeScheduleMatch.courtIndex,
                }
              : null
          }
          onSelect={(slot) => {
            if (!changeScheduleRequest) return;
            patchMatch(changeScheduleRequest.zoneId, changeScheduleRequest.matchId, {
              playDate: slot.playDate,
              startTime: slot.startTime,
              courtIndex: slot.courtIndex,
            });
            setChangeScheduleRequest(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
