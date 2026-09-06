"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updatePlayDaysAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/configuracion/actions";
import type { PlayDayValues } from "@/modules/tournaments/domain/config-schema";
import {
  canShiftPlayDayVisibleWindow,
  shiftPlayDayVisibleWindow,
  type PlayDayWindowDelta,
  type PlayDayWindowEdge,
} from "@/modules/tournaments/domain/play-day-slots";

export function useAdjustablePlayDays({
  clubSlug,
  tournamentId,
  playDays,
  slotMinutesForDate,
  readOnly = false,
}: {
  clubSlug: string;
  tournamentId: string;
  playDays: PlayDayValues[];
  slotMinutesForDate: (playDate: string) => number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(playDays);
  const dirtyRef = useRef(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (dirtyRef.current) return;
    setDraft(playDays);
  }, [playDays]);

  function adjustPlayDay(
    playDate: string,
    edge: PlayDayWindowEdge,
    delta: PlayDayWindowDelta,
  ) {
    if (readOnly) return;
    const current = draft.find((day) => day.date === playDate);
    if (!current) return;
    const nextDay = shiftPlayDayVisibleWindow(
      current,
      slotMinutesForDate(playDate),
      edge,
      delta,
    );
    if (!nextDay) return;
    const next = draft.map((day) => (day.date === playDate ? nextDay : day));
    dirtyRef.current = true;
    setDraft(next);
    startTransition(async () => {
      const result = await updatePlayDaysAction(clubSlug, tournamentId, next);
      if (!result.ok) {
        dirtyRef.current = false;
        setDraft(playDays);
        toast.error("No se pudo guardar el rango", {
          description: result.error,
        });
        return;
      }
      dirtyRef.current = false;
      router.refresh();
    });
  }

  function canAdjustPlayDay(
    playDate: string,
    edge: PlayDayWindowEdge,
    delta: PlayDayWindowDelta,
  ) {
    if (readOnly) return false;
    const current = draft.find((day) => day.date === playDate);
    return canShiftPlayDayVisibleWindow(
      current,
      slotMinutesForDate(playDate),
      edge,
      delta,
    );
  }

  return {
    playDays: draft,
    adjustPlayDay,
    canAdjustPlayDay,
    adjustPending: pending,
  };
}
