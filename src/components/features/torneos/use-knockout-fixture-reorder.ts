"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { saveKnockoutFixtureDraftAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import type { FapCrossing } from "@/modules/tournaments/domain/fap-llaves";
import {
  swapFixtureMatchSchedules,
  type IntermediateFixturePersisted,
  type KnockoutFixturePhase,
} from "@/modules/tournaments/domain/intermediate-fixture-schema";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import { useFixtureEditMode } from "./fixture-edit-mode-context";
import { useTournamentReadOnly } from "./tournament-mode-context";
import type { IntermediateCrossingSchedule } from "./intermediate-round-card";

export function useKnockoutFixtureReorder({
  clubSlug,
  tournamentId,
  categoryId,
  phase,
  fixture,
  dayOpenByDate,
}: {
  clubSlug: string;
  tournamentId: string;
  categoryId: string;
  phase: KnockoutFixturePhase;
  fixture: IntermediateFixturePersisted | null | undefined;
  dayOpenByDate?: Record<string, string>;
}) {
  const readOnly = useTournamentReadOnly();
  const { isManual } = useFixtureEditMode();
  const [draft, setDraft] = useState(fixture ?? null);

  useEffect(() => {
    setDraft(fixture ?? null);
  }, [fixture]);

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

  const canReorder = isManual && !readOnly && Boolean(draft?.rounds.length);

  function orderedCrossings(crossings: FapCrossing[]): FapCrossing[] {
    return [...crossings].sort((left, right) => {
      const bySchedule = comparePlayDaySchedule(
        scheduleByOfficialId.get(left.id) ?? {},
        scheduleByOfficialId.get(right.id) ?? {},
        dayOpenByDate,
      );
      if (bySchedule !== 0) return bySchedule;
      return left.id - right.id;
    });
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
    void saveKnockoutFixtureDraftAction(
      clubSlug,
      tournamentId,
      categoryId,
      phase,
      next,
    ).then((result) => {
      if (!result.ok) {
        setDraft(draft);
        toast.error("No se pudo guardar el orden", {
          description: result.error,
        });
      }
    });
  }

  return {
    scheduleByOfficialId,
    canReorder,
    orderedCrossings,
    moveCrossing,
  };
}
