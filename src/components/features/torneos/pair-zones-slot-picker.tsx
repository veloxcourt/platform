"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SlotRuleGrid } from "@/components/features/torneos/slot-rule-grid";
import {
  replacePairSlotPreferencesAction,
  togglePairSlotAction,
  updatePairZonesDayPreferenceAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import type { TournamentConfig } from "@/modules/tournaments/domain/types";
import type { SlotReservationItem } from "@/modules/tournaments/domain/types";
import type { CourtDaySlot } from "@/modules/tournaments/domain/court-day-slots";
import {
  listSelectablePreferenceSlots,
  listSelectablePreferenceSlotsForDay,
} from "@/modules/tournaments/domain/court-day-slots";
import {
  buildCategoryZonesGrid,
  estimateIntermediateMatches,
  findPreferenceSlotInRules,
} from "@/modules/tournaments/domain/zones-slot-registration";
import type { TournamentCategoryItem } from "@/modules/tournaments/domain/types";
import {
  ZONES_DAY_PREFERENCE_LABELS,
  ZONES_DAY_PREFERENCE_VALUES,
  type ZonesDayPreference,
} from "@/modules/tournaments/domain/zones-day-preference";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type LocalPreferenceSlot = {
  playDate: string;
  courtIndex: number;
  slotIndex: number;
  pairId: string;
  pairLabel: string;
};

export type PairDraftPreferences = {
  dayPreference: ZonesDayPreference;
  slots: Array<{
    playDate: string;
    slotIndex: number;
    startTime: string;
    endTime: string;
  }>;
};

function preferenceKey(playDate: string, slotIndex: number) {
  return `${playDate}:${slotIndex}`;
}

function preferencesFingerprint(
  items: Array<{ playDate: string; slotIndex: number }>,
) {
  return items
    .map((item) => preferenceKey(item.playDate, item.slotIndex))
    .sort()
    .join("|");
}

export function PairZonesSlotPicker({
  clubSlug,
  tournamentId,
  pairId,
  categoryId,
  config,
  courtCount,
  categories,
  reservations,
  zonesDayPreference: initialDayPreference = "ANY",
  persist = true,
  onDraftChange,
  onChanged,
}: {
  clubSlug: string;
  tournamentId: string;
  pairId: string;
  categoryId: string;
  config: TournamentConfig | null;
  courtCount: number;
  categories: TournamentCategoryItem[];
  reservations: SlotReservationItem[];
  zonesDayPreference?: ZonesDayPreference;
  persist?: boolean;
  onDraftChange?: (draft: PairDraftPreferences) => void;
  onChanged?: () => void;
}) {
  const inFlightRef = useRef(new Set<string>());
  const expectedFingerprintRef = useRef<string | null>(null);
  const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingToggles, setPendingToggles] = useState(0);
  const [bulkPending, setBulkPending] = useState(false);
  const [dayPreference, setDayPreference] = useState<ZonesDayPreference>(
    initialDayPreference,
  );
  const [localReservations, setLocalReservations] = useState<
    LocalPreferenceSlot[]
  >([]);

  function notifyChanged() {
    if (!onChanged) return;
    if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    notifyTimerRef.current = setTimeout(() => {
      notifyTimerRef.current = null;
      onChanged();
    }, 450);
  }

  useEffect(() => {
    return () => {
      if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setDayPreference(initialDayPreference);
  }, [initialDayPreference, pairId]);

  const mineReservations = useMemo(
    () => reservations.filter((r) => r.pairId === pairId),
    [reservations, pairId],
  );

  useEffect(() => {
    expectedFingerprintRef.current = null;
  }, [pairId]);

  useEffect(() => {
    // No pisar el estado optimista con un snapshot viejo del servidor.
    if (pendingToggles > 0 || bulkPending) return;

    const serverFingerprint = preferencesFingerprint(mineReservations);
    if (
      expectedFingerprintRef.current != null &&
      expectedFingerprintRef.current !== serverFingerprint
    ) {
      return;
    }

    expectedFingerprintRef.current = null;
    setLocalReservations(
      mineReservations.map((r) => ({
        playDate: r.playDate,
        courtIndex: r.courtIndex,
        slotIndex: r.slotIndex,
        pairId: r.pairId,
        pairLabel: r.pairLabel,
      })),
    );
  }, [mineReservations, pairId, pendingToggles, bulkPending]);

  const categoryConfig = config?.categories.find(
    (c) => c.categoryId === categoryId,
  );
  const category = categories.find((c) => c.id === categoryId);

  const rules = useMemo(() => {
    if (!config || !categoryConfig) return [];
    const confirmedPairsForEstimate =
      category?.simulationConfirmedCount ??
      category?.confirmedCount ??
      8;

    const preferenceRefs = localReservations.map((r) => ({
      pairId: r.pairId,
      pairLabel: r.pairLabel,
      playDate: r.playDate,
      courtIndex: r.courtIndex,
      slotIndex: r.slotIndex,
    }));

    let intermediateMatches = 0;
    for (const cat of config.categories) {
      const catMeta = categories.find((c) => c.id === cat.categoryId);
      const n =
        cat.categoryId === categoryId
          ? confirmedPairsForEstimate
          : (catMeta?.simulationConfirmedCount ??
            catMeta?.confirmedCount ??
            0);
      if (n <= 0) continue;
      intermediateMatches += estimateIntermediateMatches(
        n,
        cat,
        config.playDays,
        courtCount,
      );
    }

    return buildCategoryZonesGrid({
      categoryConfig,
      playDays: config.playDays,
      courtCount,
      confirmedPairsForEstimate,
      reservations: preferenceRefs,
      currentPairId: pairId,
      intermediateMatchesOverride: intermediateMatches,
      preferenceMode: true,
    });
  }, [
    config,
    categoryConfig,
    courtCount,
    category,
    categories,
    localReservations,
    categoryId,
    pairId,
  ]);

  const mineCount = useMemo(() => {
    const keys = new Set(
      localReservations.map((r) => preferenceKey(r.playDate, r.slotIndex)),
    );
    return keys.size;
  }, [localReservations]);

  const eligibleSlots = useMemo(
    () => listSelectablePreferenceSlots(rules),
    [rules],
  );

  const allMarked =
    eligibleSlots.length > 0 && mineCount === eligibleSlots.length;
  const noneMarked = mineCount === 0;

  function draftSlotsFromReservations(
    reservations: LocalPreferenceSlot[],
  ): PairDraftPreferences["slots"] {
    const slots: PairDraftPreferences["slots"] = [];
    for (const reservation of reservations) {
      const slot = findPreferenceSlotInRules(
        rules,
        reservation.playDate,
        reservation.slotIndex,
      );
      if (!slot) continue;
      slots.push({
        playDate: reservation.playDate,
        slotIndex: reservation.slotIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
    return slots;
  }

  function emitDraftChange(
    reservations: LocalPreferenceSlot[],
    preference: ZonesDayPreference,
  ) {
    if (persist || !onDraftChange) return;
    onDraftChange({
      dayPreference: preference,
      slots: draftSlotsFromReservations(reservations),
    });
  }

  useEffect(() => {
    if (persist || !onDraftChange) return;
    emitDraftChange(localReservations, dayPreference);
  }, [
    persist,
    onDraftChange,
    localReservations,
    dayPreference,
    rules,
  ]);

  function slotsToLocal(slots: CourtDaySlot[]): LocalPreferenceSlot[] {
    const pairLabel = localReservations[0]?.pairLabel ?? "";
    return slots.map((slot) => ({
      playDate: slot.playDate,
      courtIndex: 0,
      slotIndex: slot.slotIndex,
      pairId,
      pairLabel,
    }));
  }

  function applyBulkPreferences(slots: CourtDaySlot[]) {
    const previous = localReservations;
    const next = slotsToLocal(slots);
    if (!persist) {
      setLocalReservations(next);
      emitDraftChange(next, dayPreference);
      return;
    }

    setBulkPending(true);
    setLocalReservations(next);
    expectedFingerprintRef.current = preferencesFingerprint(next);

    void replacePairSlotPreferencesAction(clubSlug, tournamentId, pairId, {
      slots: slots.map((slot) => ({
        playDate: slot.playDate,
        slotIndex: slot.slotIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    })
      .then((result) => {
        if (!result.ok) {
          expectedFingerprintRef.current = preferencesFingerprint(previous);
          setLocalReservations(previous);
          toast.error("No se pudieron actualizar las preferencias", {
            description: result.error,
          });
          return;
        }
        notifyChanged();
      })
      .finally(() => {
        setBulkPending(false);
      });
  }

  function onMarkAll() {
    if (bulkPending || pendingToggles > 0 || allMarked) return;
    applyBulkPreferences(eligibleSlots);
  }

  function onClearAll() {
    if (bulkPending || pendingToggles > 0 || noneMarked) return;
    applyBulkPreferences([]);
  }

  function onMarkDay(playDate: string) {
    if (bulkPending || pendingToggles > 0) return;
    const day = rules.find((rule) => rule.playDate === playDate);
    if (!day) return;

    const daySlots = listSelectablePreferenceSlotsForDay(day);
    if (daySlots.length === 0) return;

    const keepOtherDays = eligibleSlots.filter(
      (slot) =>
        slot.playDate !== playDate &&
        localReservations.some(
          (r) =>
            r.playDate === slot.playDate && r.slotIndex === slot.slotIndex,
        ),
    );
    applyBulkPreferences([...keepOtherDays, ...daySlots]);
  }

  function onClearDay(playDate: string) {
    if (bulkPending || pendingToggles > 0) return;
    const keepOtherDays = eligibleSlots.filter(
      (slot) =>
        slot.playDate !== playDate &&
        localReservations.some(
          (r) =>
            r.playDate === slot.playDate && r.slotIndex === slot.slotIndex,
        ),
    );
    applyBulkPreferences(keepOtherDays);
  }

  function onToggleSlot(slot: CourtDaySlot) {
    const key = preferenceKey(slot.playDate, slot.slotIndex);
    if (bulkPending || inFlightRef.current.has(key)) return;

    const isOn = localReservations.some(
      (r) =>
        r.playDate === slot.playDate && r.slotIndex === slot.slotIndex,
    );
    const previous = localReservations;
    const next = isOn
      ? localReservations.filter(
          (r) =>
            !(
              r.playDate === slot.playDate && r.slotIndex === slot.slotIndex
            ),
        )
      : [
          ...localReservations,
          {
            playDate: slot.playDate,
            courtIndex: 0,
            slotIndex: slot.slotIndex,
            pairId,
            pairLabel: localReservations[0]?.pairLabel ?? "",
          },
        ];

    if (!persist) {
      setLocalReservations(next);
      emitDraftChange(next, dayPreference);
      return;
    }

    setLocalReservations(next);
    expectedFingerprintRef.current = preferencesFingerprint(next);

    inFlightRef.current.add(key);
    setPendingToggles((n) => n + 1);
    void togglePairSlotAction(clubSlug, tournamentId, pairId, {
      playDate: slot.playDate,
      courtIndex: 0,
      slotIndex: slot.slotIndex,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })
      .then((result) => {
        if (!result.ok) {
          expectedFingerprintRef.current = preferencesFingerprint(previous);
          setLocalReservations(previous);
          toast.error("No se pudo actualizar la preferencia", {
            description: result.error,
          });
          return;
        }
        notifyChanged();
      })
      .finally(() => {
        inFlightRef.current.delete(key);
        setPendingToggles((n) => n - 1);
      });
  }

  function onDayPreferenceChange(value: ZonesDayPreference) {
    const previous = dayPreference;
    setDayPreference(value);
    if (!persist) {
      emitDraftChange(localReservations, value);
      return;
    }

    void updatePairZonesDayPreferenceAction(clubSlug, tournamentId, pairId, {
      zonesDayPreference: value,
    }).then((result) => {
      if (!result.ok) {
        setDayPreference(previous);
        toast.error("No se pudo guardar la preferencia de días", {
          description: result.error,
        });
        return;
      }
      notifyChanged();
    });
  }

  if (!config || !categoryConfig) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Configurá días y fases del torneo para indicar rangos de preferencia.
      </p>
    );
  }

  if (categoryConfig.phases.zones.playDates.length === 0) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Asigná días a la fase de zonas en Configuración para poder marcar
        rangos de preferencia.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Rangos de preferencia</p>
        <p className="text-xs text-muted-foreground">
          Solo días de la fase de zonas. Marcá los horarios en los que la pareja
          podría jugar sus 2 partidos (indistinto de cancha). Varias parejas
          pueden marcar el mismo horario. Los tramos de intermedia en días
          compartidos aparecen bloqueados.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`zones-day-pref-${pairId}`}>
          Distribución de los 2 partidos
        </Label>
        <select
          id={`zones-day-pref-${pairId}`}
          className={SELECT_CLASS}
          value={dayPreference}
          onChange={(e) =>
            onDayPreferenceChange(e.target.value as ZonesDayPreference)
          }
        >
          {ZONES_DAY_PREFERENCE_VALUES.map((value) => (
            <option key={value} value={value}>
              {ZONES_DAY_PREFERENCE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Celdas marcadas:{" "}
          <span className="font-medium text-foreground">{mineCount}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onMarkAll}
            disabled={bulkPending || pendingToggles > 0 || allMarked}
          >
            Marcar todas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearAll}
            disabled={bulkPending || pendingToggles > 0 || noneMarked}
          >
            Desmarcar todas
          </Button>
        </div>
      </div>

      <SlotRuleGrid
        mode="registration"
        rules={rules}
        interactive={!bulkPending}
        mineCount={mineCount}
        onToggleSlot={onToggleSlot}
        onMarkDay={onMarkDay}
        onClearDay={onClearDay}
        dayActionsDisabled={bulkPending || pendingToggles > 0}
        showMineCount={false}
      />
    </div>
  );
}
