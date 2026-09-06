"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { saveKnockoutFixtureDraftAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import type { FapCrossing } from "@/modules/tournaments/domain/fap-llaves";
import {
  seedKnockoutFixture,
  setFixtureMatchSchedule,
  swapFixtureMatchSchedules,
  type IntermediateFixturePersisted,
  type KnockoutFixturePhase,
} from "@/modules/tournaments/domain/intermediate-fixture-schema";
import type { OfficialRound } from "@/modules/tournaments/domain/intermediate-phase";
import { collectKnockoutScores, setKnockoutMatchScore } from "@/modules/tournaments/domain/match-scores";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import {
  useFixtureEditMode,
  useRegisterFixturePersistFlush,
} from "./fixture-edit-mode-context";
import { useTournamentReadOnly } from "./tournament-mode-context";
import type { IntermediateCrossingSchedule } from "./intermediate-round-card";

export function useKnockoutFixtureReorder({
  clubSlug,
  tournamentId,
  categoryId,
  phase,
  fixture,
  dayOpenByDate,
  officialRounds,
}: {
  clubSlug: string;
  tournamentId: string;
  categoryId: string;
  phase: KnockoutFixturePhase;
  fixture: IntermediateFixturePersisted | null | undefined;
  dayOpenByDate?: Record<string, string>;
  officialRounds: OfficialRound[];
}) {
  const readOnly = useTournamentReadOnly();
  const { isManual } = useFixtureEditMode(categoryId, phase);
  const [draft, setDraft] = useState(fixture ?? null);
  const [manualOrderByKey, setManualOrderByKey] = useState<
    Record<string, number[]>
  >({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<IntermediateFixturePersisted | null>(null);
  const dirtyRef = useRef(false);
  const flushPersistRef = useRef<() => Promise<unknown>>(async () => ({
    ok: true,
  }));
  useRegisterFixturePersistFlush(() => flushPersistRef.current());

  useEffect(() => {
    dirtyRef.current = false;
    setDraft(fixture ?? null);
    setManualOrderByKey({});
  }, [categoryId, phase]);

  useEffect(() => {
    if (dirtyRef.current) return;
    setDraft(fixture ?? null);
  }, [fixture]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) {
        void saveKnockoutFixtureDraftAction(
          clubSlug,
          tournamentId,
          categoryId,
          phase,
          pending,
        );
      }
    };
  }, [categoryId, clubSlug, phase, tournamentId]);

  async function flushPersist() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return { ok: true as const };
    pendingRef.current = null;
    const result = await saveKnockoutFixtureDraftAction(
      clubSlug,
      tournamentId,
      categoryId,
      phase,
      pending,
    );
    if (!result.ok) {
      toast.error("No se pudo guardar el resultado", {
        description: result.error,
      });
      dirtyRef.current = true;
      return result;
    }
    if (!pendingRef.current) dirtyRef.current = false;
    return result;
  }
  flushPersistRef.current = flushPersist;

  function queueSave(next: IntermediateFixturePersisted, immediate = false) {
    dirtyRef.current = true;
    pendingRef.current = next;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (immediate) {
      void flushPersist();
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      void flushPersist();
    }, 600);
  }

  const scheduleByOfficialId = useMemo(() => {
    const map = new Map<number, IntermediateCrossingSchedule>();
    for (const round of draft?.rounds ?? []) {
      for (const match of round.matches) {
        map.set(match.officialId, {
          playDate: match.playDate,
          startTime: match.startTime,
          courtIndex: match.courtIndex,
          noRestGap: match.noRestGap,
        });
      }
    }
    return map;
  }, [draft]);

  const scoresByOfficialId = useMemo(
    () => collectKnockoutScores(draft),
    [draft],
  );

  const canReorder = isManual && !readOnly && Boolean(draft?.rounds.length);

  function currentOrSeededDraft() {
    return draft ?? seedKnockoutFixture(officialRounds);
  }

  function updateScore(officialId: number, key: string, value: string) {
    if (readOnly) return;
    const next = setKnockoutMatchScore(
      currentOrSeededDraft(),
      officialId,
      key,
      value,
    );
    setDraft(next);
    queueSave(next);
  }

  function updateSchedule(
    officialId: number,
    slot: {
      playDate: string;
      startTime: string;
      courtIndex: number;
      endTime?: string;
      slotIndex?: number;
    },
  ) {
    if (readOnly || !isManual) return;
    const next = setFixtureMatchSchedule(currentOrSeededDraft(), officialId, {
      playDate: slot.playDate,
      startTime: slot.startTime,
      courtIndex: slot.courtIndex,
      endTime: slot.endTime ?? null,
      slotIndex: slot.slotIndex ?? null,
      noRestGap: false,
    });
    setDraft(next);
    queueSave(next, true);
  }

  function compareCrossingSchedule(left: FapCrossing, right: FapCrossing) {
    const bySchedule = comparePlayDaySchedule(
      scheduleByOfficialId.get(left.id) ?? {},
      scheduleByOfficialId.get(right.id) ?? {},
      dayOpenByDate,
    );
    if (bySchedule !== 0) return bySchedule;
    const leftCourt = scheduleByOfficialId.get(left.id)?.courtIndex ?? 999;
    const rightCourt = scheduleByOfficialId.get(right.id)?.courtIndex ?? 999;
    if (leftCourt !== rightCourt) return leftCourt - rightCourt;
    return left.id - right.id;
  }

  function crossingsKey(crossings: FapCrossing[]) {
    return [...crossings]
      .map((crossing) => crossing.id)
      .sort((left, right) => left - right)
      .join(",");
  }

  function applyManualOrder(crossings: FapCrossing[]) {
    const override = manualOrderByKey[crossingsKey(crossings)];
    if (!override?.length) return [...crossings];
    const byId = new Map(crossings.map((crossing) => [crossing.id, crossing]));
    const ordered = override
      .map((id) => byId.get(id))
      .filter((crossing): crossing is FapCrossing => Boolean(crossing));
    for (const crossing of crossings) {
      if (!override.includes(crossing.id)) ordered.push(crossing);
    }
    return ordered;
  }

  function orderedCrossings(crossings: FapCrossing[]): FapCrossing[] {
    if (isManual) return applyManualOrder(crossings);
    return [...crossings].sort(compareCrossingSchedule);
  }

  function sortCrossingsBySchedule(crossings: FapCrossing[]) {
    if (!isManual) return;
    const sorted = [...crossings].sort(compareCrossingSchedule);
    setManualOrderByKey((current) => ({
      ...current,
      [crossingsKey(crossings)]: sorted.map((crossing) => crossing.id),
    }));
  }

  function moveCrossing(
    crossings: FapCrossing[],
    officialId: number,
    direction: "up" | "down",
  ) {
    if (!draft || !canReorder) return;
    const ordered = orderedCrossings(crossings);
    const index = ordered.findIndex((item) => item.id === officialId);
    const other =
      direction === "up" ? ordered[index - 1] : ordered[index + 1];
    if (index < 0 || !other) return;
    if (!scheduleByOfficialId.has(officialId) || !scheduleByOfficialId.has(other.id)) {
      toast.error("Ese partido todavía no tiene un horario para intercambiar");
      return;
    }
    const next = swapFixtureMatchSchedules(draft, officialId, other.id);
    setDraft(next);
    queueSave(next, true);
  }

  return {
    draft,
    scheduleByOfficialId,
    scoresByOfficialId,
    canReorder,
    canEditSchedule: isManual && !readOnly,
    orderedCrossings,
    sortCrossingsBySchedule,
    moveCrossing,
    updateScore,
    updateSchedule,
    flushPersist,
  };
}
