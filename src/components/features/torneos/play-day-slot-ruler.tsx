"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import type { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { TournamentConfigValues } from "@/modules/tournaments/domain/config-schema";
import {
  adjustPlayDayWindow,
  buildPlayDayRulerSlots,
  canAdjustPlayDayWindow,
  derivePlayDayEndTime,
  effectiveOvernightExtraSlots,
  remapEnabledSlotIndexes,
  resolveEnabledSlotIndexes,
  toPlayDayValues,
  type PlayDayRulerSlot,
} from "@/modules/tournaments/domain/play-day-slots";

function formatSlotHours(totalMinutes: number): string {
  if (totalMinutes <= 0) return "—";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} h`;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function formatSlotsWithClock(slotCount: number, totalMinutes: number): string {
  const label = `${slotCount} slot${slotCount === 1 ? "" : "s"}`;
  if (totalMinutes <= 0) return label;
  return `${label} (${formatSlotHours(totalMinutes)})`;
}

type FormApi = {
  control: ReturnType<typeof useForm<TournamentConfigValues>>["control"];
  setValue: ReturnType<typeof useForm<TournamentConfigValues>>["setValue"];
  errors: ReturnType<
    typeof useForm<TournamentConfigValues>
  >["formState"]["errors"];
};

function commitDay(
  setValue: FormApi["setValue"],
  index: number,
  patch: {
    startTime: string;
    overnightExtraSlots: number;
    enabledSlotIndexes: number[];
    endTime: string;
    intermediateSlotIndexes?: number[];
  },
) {
  setValue(`playDays.${index}.startTime`, patch.startTime, {
    shouldDirty: true,
    shouldValidate: true,
  });
  setValue(`playDays.${index}.overnightExtraSlots`, patch.overnightExtraSlots, {
    shouldDirty: true,
  });
  setValue(`playDays.${index}.enabledSlotIndexes`, patch.enabledSlotIndexes, {
    shouldDirty: true,
  });
  setValue(`playDays.${index}.hasSlotSelection`, true, { shouldDirty: true });
  setValue(`playDays.${index}.endTime`, patch.endTime, {
    shouldDirty: true,
    shouldValidate: true,
  });
  if (patch.intermediateSlotIndexes !== undefined) {
    setValue(
      `playDays.${index}.intermediateSlotIndexes`,
      patch.intermediateSlotIndexes,
      { shouldDirty: true },
    );
  }
}

export function playDayRulerState(
  day: TournamentConfigValues["playDays"][number] | undefined,
  slotMinutes: number,
): {
  overnight: number;
  ruler: PlayDayRulerSlot[];
  enabled: number[];
} {
  if (!day?.startTime) {
    return { overnight: 0, ruler: [], enabled: [] };
  }
  const overnight = effectiveOvernightExtraSlots(day, slotMinutes);
  const ruler = buildPlayDayRulerSlots(day.startTime, overnight, slotMinutes);
  const enabled = resolveEnabledSlotIndexes(day, ruler);
  return { overnight, ruler, enabled };
}

export function PlayDaysRulerToolbar({
  markedCount,
  allMarked,
  noneMarked,
  onMarkAll,
  onClearAll,
  readOnly,
  slotMinutes,
}: {
  markedCount: number;
  allMarked: boolean;
  noneMarked: boolean;
  onMarkAll: () => void;
  onClearAll: () => void;
  readOnly: boolean;
  slotMinutes: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Celdas marcadas:{" "}
        <span className="font-medium text-foreground">{markedCount}</span>
        {" · "}
        cada slot dura {slotMinutes} min
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMarkAll}
          disabled={readOnly || allMarked}
        >
          Marcar todas
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearAll}
          disabled={readOnly || noneMarked}
        >
          Desmarcar todas
        </Button>
      </div>
    </div>
  );
}

export function EdgeButtons({
  side,
  onAdd,
  onRemove,
  addDisabled,
  removeDisabled,
  readOnly,
}: {
  side: "left" | "right";
  onAdd: () => void;
  onRemove: () => void;
  addDisabled: boolean;
  removeDisabled: boolean;
  readOnly: boolean;
}) {
  const addLabel =
    side === "left"
      ? "Sumar slot al inicio"
      : "Sumar slot al final (puede ser después de las 0 hs)";
  const removeLabel =
    side === "left" ? "Quitar slot del inicio" : "Quitar slot del final";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0 px-2"
        title={addLabel}
        aria-label={addLabel}
        disabled={readOnly || addDisabled}
        onClick={onAdd}
      >
        <Plus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0 px-2"
        title={removeLabel}
        aria-label={removeLabel}
        disabled={readOnly || removeDisabled}
        onClick={onRemove}
      >
        <Minus className="size-4" />
      </Button>
    </div>
  );
}

export function PlayDaySlotRuler({
  index,
  control,
  setValue,
  errors,
  courtCount,
  slotMinutes,
  readOnly,
  playDayCount,
  categoryCount,
}: {
  index: number;
  courtCount: number;
  slotMinutes: number;
  readOnly: boolean;
  playDayCount: number;
  categoryCount: number;
} & FormApi) {
  const day = useWatch({
    control,
    name: `playDays.${index}`,
  });
  const { overnight, ruler, enabled } = playDayRulerState(day, slotMinutes);
  const enabledSet = new Set(enabled);
  const intermediateIndexes = day?.intermediateSlotIndexes ?? [];
  const intermediateSet = new Set(intermediateIndexes);
  const dayAllMarked = ruler.length > 0 && enabled.length === ruler.length;
  const dayNoneMarked = enabled.length === 0;
  const selectedMinutes = enabled.length * Math.max(1, slotMinutes);
  const courts = courtCount > 0 ? courtCount : 0;
  const totalMinutes = selectedMinutes * courts;
  const startTime = day?.startTime ?? "";
  const isIntermediateDay = day?.isIntermediateDay === true;
  const intermediateCount = intermediateIndexes.length;
  const prevSlotMinutesRef = useRef(slotMinutes);

  function applySelection(
    nextEnabled: number[],
    nextOvernight = overnight,
    nextStart = startTime,
    nextIntermediate: number[] | undefined = intermediateIndexes,
  ) {
    const nextRuler = buildPlayDayRulerSlots(
      nextStart,
      nextOvernight,
      slotMinutes,
    );
    const enabledSetNext = new Set(nextEnabled);
    const cleanedIntermediate = (nextIntermediate ?? [])
      .filter((slotIndex) => enabledSetNext.has(slotIndex))
      .sort((a, b) => a - b);
    commitDay(setValue, index, {
      startTime: nextStart,
      overnightExtraSlots: nextOvernight,
      enabledSlotIndexes: nextEnabled,
      endTime: derivePlayDayEndTime(nextStart, nextRuler, nextEnabled),
      intermediateSlotIndexes: cleanedIntermediate,
    });
  }

  useEffect(() => {
    const previousMinutes = prevSlotMinutesRef.current;
    if (previousMinutes === slotMinutes) return;
    prevSlotMinutesRef.current = slotMinutes;
    if (readOnly || !day?.hasSlotSelection || !startTime) return;
    const previousRuler = buildPlayDayRulerSlots(
      startTime,
      overnight,
      previousMinutes,
    );
    const nextRuler = buildPlayDayRulerSlots(
      startTime,
      overnight,
      slotMinutes,
    );
    const remapped = remapEnabledSlotIndexes(
      previousRuler,
      day.enabledSlotIndexes ?? [],
      nextRuler,
    );
    const remappedIntermediate = remapEnabledSlotIndexes(
      previousRuler,
      day.intermediateSlotIndexes ?? [],
      nextRuler,
    );
    applySelection(remapped, overnight, startTime, remappedIntermediate);
  }, [slotMinutes]);

  function onToggleSlot(slotIndex: number) {
    if (readOnly) return;
    const next = enabledSet.has(slotIndex)
      ? enabled.filter((value) => value !== slotIndex)
      : [...enabled, slotIndex].sort((a, b) => a - b);
    applySelection(next);
  }

  function onToggleIntermediateSlot(slotIndex: number) {
    if (readOnly || !isIntermediateDay) return;
    const selected = intermediateSet.has(slotIndex);
    const nextIntermediate = selected
      ? intermediateIndexes.filter((value) => value !== slotIndex)
      : [...intermediateIndexes, slotIndex].sort((a, b) => a - b);
    const nextEnabled = enabledSet.has(slotIndex)
      ? enabled
      : [...enabled, slotIndex].sort((a, b) => a - b);
    applySelection(nextEnabled, overnight, startTime, nextIntermediate);
  }

  function syncKnockoutPlayDates(dates: string[]) {
    for (let catIndex = 0; catIndex < categoryCount; catIndex += 1) {
      setValue(`categories.${catIndex}.phases.knockout.playDates`, dates, {
        shouldDirty: true,
      });
    }
  }

  function onToggleIntermediateDay(checked: boolean) {
    if (readOnly) return;
    const date = day?.date?.trim() ?? "";
    for (let dayIndex = 0; dayIndex < playDayCount; dayIndex += 1) {
      const active = checked && dayIndex === index;
      setValue(`playDays.${dayIndex}.isIntermediateDay`, active, {
        shouldDirty: true,
      });
      if (!active) {
        setValue(`playDays.${dayIndex}.intermediateSlotIndexes`, [], {
          shouldDirty: true,
        });
      }
    }
    syncKnockoutPlayDates(checked && date ? [date] : []);
  }

  function applyWindow(
    edge: "start" | "end",
    delta: "add" | "remove",
  ) {
    if (readOnly || !day) return;
    const next = adjustPlayDayWindow(
      toPlayDayValues(day),
      slotMinutes,
      edge,
      delta,
    );
    if (!next) return;
    commitDay(setValue, index, {
      startTime: next.startTime,
      overnightExtraSlots: next.overnightExtraSlots,
      enabledSlotIndexes: next.enabledSlotIndexes,
      endTime: next.endTime,
      intermediateSlotIndexes: next.intermediateSlotIndexes,
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="flex items-center gap-2 font-medium">
          <span>Día {index + 1}</span>
          <Checkbox
            checked={isIntermediateDay}
            disabled={readOnly || !day?.date}
            onCheckedChange={(value) => onToggleIntermediateDay(value === true)}
            aria-label={`Día ${index + 1}: fase intermedia`}
            title="Marcar como día de fase intermedia (solo uno)"
            className="border-orange-400 data-checked:border-orange-500 data-checked:bg-orange-500"
          />
          <span className="text-xs font-normal text-muted-foreground">
            Fase intermedia
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          {formatSlotsWithClock(enabled.length, selectedMinutes)}
          {courts > 1 && enabled.length > 0
            ? ` · ${formatSlotsWithClock(enabled.length * courts, totalMinutes)} tot.`
            : ""}
          {isIntermediateDay && intermediateCount > 0
            ? ` · ${intermediateCount} slot${intermediateCount === 1 ? "" : "s"} intermedia`
            : ""}
        </p>
      </div>

      <div className="max-w-full overflow-x-auto">
        <div className="flex w-max flex-nowrap items-end gap-1.5">
          <EdgeButtons
            side="left"
            onAdd={() => applyWindow("start", "add")}
            onRemove={() => applyWindow("start", "remove")}
            addDisabled={
              !canAdjustPlayDayWindow(
                day ? toPlayDayValues(day) : undefined,
                slotMinutes,
                "start",
                "add",
              )
            }
            removeDisabled={
              !canAdjustPlayDayWindow(
                day ? toPlayDayValues(day) : undefined,
                slotMinutes,
                "start",
                "remove",
              )
            }
            readOnly={readOnly}
          />
          {ruler.map((slot) => {
            const selected = enabledSet.has(slot.slotIndex);
            const intermediate = intermediateSet.has(slot.slotIndex);
            return (
              <div
                key={slot.slotIndex}
                className="flex w-10 shrink-0 flex-col items-center gap-1"
              >
                {isIntermediateDay ? (
                  <button
                    type="button"
                    disabled={readOnly}
                    title={
                      intermediate
                        ? `${slot.startTime}: quitar de intermedia`
                        : `${slot.startTime}: usar en intermedia`
                    }
                    aria-pressed={intermediate}
                    aria-label={`${slot.startTime} intermedia`}
                    onClick={() => onToggleIntermediateSlot(slot.slotIndex)}
                    className={cn(
                      "h-3 w-8 rounded-sm border-2 transition-colors",
                      intermediate
                        ? "border-orange-500 bg-orange-500 hover:border-orange-600 hover:bg-orange-600"
                        : "border-orange-400 bg-transparent hover:bg-orange-100 dark:border-orange-500 dark:hover:bg-orange-950/40",
                      !readOnly && "cursor-pointer",
                    )}
                  />
                ) : (
                  <span className="h-3 w-8" aria-hidden />
                )}
                <button
                  type="button"
                  disabled={readOnly}
                  title={`${slot.startTime}–${slot.endTime}`}
                  aria-pressed={selected}
                  aria-label={`${slot.startTime} ${
                    selected ? "usado para juego" : "no se usa"
                  }`}
                  onClick={() => onToggleSlot(slot.slotIndex)}
                  className={cn(
                    "flex h-10 w-full flex-col items-center justify-center rounded-md border px-1 text-[10px] leading-tight transition-colors",
                    selected
                      ? "border-sky-400 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100"
                      : "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
                    !readOnly && "cursor-pointer",
                  )}
                >
                  <span className="font-semibold tabular-nums">
                    {slot.startTime}
                  </span>
                </button>
              </div>
            );
          })}
          <EdgeButtons
            side="right"
            onAdd={() => applyWindow("end", "add")}
            onRemove={() => applyWindow("end", "remove")}
            addDisabled={
              !canAdjustPlayDayWindow(
                day ? toPlayDayValues(day) : undefined,
                slotMinutes,
                "end",
                "add",
              )
            }
            removeDisabled={
              !canAdjustPlayDayWindow(
                day ? toPlayDayValues(day) : undefined,
                slotMinutes,
                "end",
                "remove",
              )
            }
            readOnly={readOnly}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 px-2 text-xs"
            onClick={() =>
              applySelection(ruler.map((slot) => slot.slotIndex))
            }
            disabled={readOnly || dayAllMarked || ruler.length === 0}
          >
            Marcar todas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 px-2 text-xs"
            onClick={() => applySelection([], overnight, startTime, [])}
            disabled={readOnly || dayNoneMarked}
          >
            Desmarcar todas
          </Button>
        </div>
      </div>

      {errors.playDays?.[index]?.startTime && (
        <p className="text-xs text-destructive">
          {errors.playDays[index]?.startTime?.message}
        </p>
      )}
      {errors.playDays?.[index]?.endTime && (
        <p className="text-xs text-destructive">
          {errors.playDays[index]?.endTime?.message}
        </p>
      )}
    </div>
  );
}
