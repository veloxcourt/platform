"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWeekdayName } from "@/lib/date";
import type {
  CourtDayRule,
  CourtDaySlot,
  SlotCellStatus,
} from "@/modules/tournaments/domain/court-day-slots";
import {
  listSelectablePreferenceSlotsForDay,
  mergeRegistrationDaySlots,
} from "@/modules/tournaments/domain/court-day-slots";

export type SlotRuleGridMode = "simulation" | "registration";

const STATUS_LABEL: Record<SlotCellStatus, string> = {
  free: "Libre",
  projected: "Proyectado",
  blocked: "Bloqueado",
  reserved: "Ocupado",
  mine: "Tu preferencia",
};

function cellClass(
  status: SlotCellStatus,
  projectedPhase?: string,
  projectedSource?: "self" | "other",
): string {
  if (status === "projected" && projectedSource === "other") {
    return "border-slate-300 bg-slate-200/90 text-slate-600 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300";
  }
  switch (status) {
    case "free":
      return "border-emerald-300/80 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "mine":
      return "border-sky-400 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100";
    case "reserved":
      return "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
    case "blocked":
      return "border-zinc-300 bg-zinc-200/80 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400";
    case "projected":
      if (projectedPhase === "knockout") {
        return "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
      }
      if (projectedPhase === "final") {
        return "border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100";
      }
      return "border-orange-400 bg-orange-100 text-orange-950 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100";
    default:
      return "border-border bg-muted";
  }
}

function isClickable(
  mode: SlotRuleGridMode,
  slot: CourtDaySlot,
  interactive: boolean,
): boolean {
  if (!interactive || mode !== "registration") return false;
  if (slot.status === "mine" || slot.status === "free") return true;
  return false;
}

export function SlotRuleGrid({
  mode,
  rules,
  interactive = false,
  mineCount = 0,
  onToggleSlot,
  onMarkDay,
  onClearDay,
  dayActionsDisabled = false,
  className,
  showMineCount = true,
}: {
  mode: SlotRuleGridMode;
  rules: CourtDayRule[];
  interactive?: boolean;
  mineCount?: number;
  onToggleSlot?: (slot: CourtDaySlot) => void;
  onMarkDay?: (playDate: string) => void;
  onClearDay?: (playDate: string) => void;
  dayActionsDisabled?: boolean;
  className?: string;
  showMineCount?: boolean;
}) {
  if (rules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {mode === "registration"
          ? "No hay días asignados a la fase de zonas. Configuralos en Configuración."
          : "Configurá días de juego para ver la regla."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {mode === "registration" && showMineCount && (
        <p className="text-sm text-muted-foreground">
          Celdas marcadas:{" "}
          <span className="font-medium text-foreground">{mineCount}</span>
          {" · "}
          marcá todos los rangos posibles (solo días de fase de zonas)
        </p>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <LegendSwatch className={cellClass("free")} label="Libre" />
        {mode === "simulation" ? (
          <>
            <LegendSwatch
              className={cellClass("projected", "zones")}
              label="Zonas (esta categoría)"
            />
            <LegendSwatch
              className={cellClass("projected", "knockout")}
              label="Intermedia"
            />
            <LegendSwatch
              className={cellClass("projected", "final")}
              label="Final"
            />
            <LegendSwatch
              className={cellClass("projected", "zones", "other")}
              label="Otra categoría"
            />
          </>
        ) : (
          <>
            <LegendSwatch className={cellClass("mine")} label="Tu preferencia" />
            <LegendSwatch
              className={cellClass("blocked")}
              label="Bloqueado (intermedia)"
            />
          </>
        )}
      </div>

      {rules.map((day) => {
        const daySlots =
          mode === "registration"
            ? mergeRegistrationDaySlots(day)
            : null;
        const selectableDaySlots =
          mode === "registration"
            ? listSelectablePreferenceSlotsForDay(day)
            : [];
        const dayMineCount =
          daySlots?.filter((slot) => slot.status === "mine").length ?? 0;
        const dayAllMarked =
          selectableDaySlots.length > 0 &&
          dayMineCount === selectableDaySlots.length;
        const dayNoneMarked = dayMineCount === 0;
        const showDayActions =
          mode === "registration" && (onMarkDay || onClearDay);

        return (
        <div key={day.playDate} className="space-y-2">
          <p className="font-medium">
            {day.dayLabel}
            {mode === "registration" && (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({formatWeekdayName(day.playDate)})
              </span>
            )}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {mode === "simulation" ? `${day.playDate} · ` : ""}
              {day.startTime}–{day.endTime}
            </span>
          </p>
          {mode === "registration" ? (
            <div className="max-w-full overflow-x-auto">
              <div className="flex w-max flex-nowrap items-center gap-1.5">
              {daySlots?.map((slot) => {
                const clickable = isClickable(mode, slot, interactive);
                const titleParts = [
                  STATUS_LABEL[slot.status],
                  `${slot.startTime}–${slot.endTime}`,
                  slot.blockReason === "knockout"
                    ? "Reservado fase intermedia"
                    : null,
                ].filter(Boolean);

                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={!clickable}
                    title={titleParts.join(" · ")}
                    aria-label={`${slot.startTime} ${STATUS_LABEL[slot.status]}`}
                    onClick={() => clickable && onToggleSlot?.(slot)}
                    className={cn(
                      "flex h-10 min-w-10 flex-col items-center justify-center rounded-md border px-1.5 text-[10px] leading-tight transition-colors",
                      cellClass(slot.status, slot.projectedPhase, slot.projectedSource),
                      clickable && "cursor-pointer",
                      !clickable && "cursor-default opacity-95",
                    )}
                  >
                    <span className="font-semibold tabular-nums">
                      {slot.startTime}
                    </span>
                  </button>
                );
              })}
              {showDayActions && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 px-2 text-xs"
                    onClick={() => onMarkDay?.(day.playDate)}
                    disabled={
                      dayActionsDisabled ||
                      dayAllMarked ||
                      selectableDaySlots.length === 0
                    }
                  >
                    Marcar todas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 px-2 text-xs"
                    onClick={() => onClearDay?.(day.playDate)}
                    disabled={dayActionsDisabled || dayNoneMarked}
                  >
                    Desmarcar todas
                  </Button>
                </>
              )}
              </div>
            </div>
          ) : (
          <div className="space-y-2">
            {day.courts.map((court) => (
              <div
                key={`${day.playDate}-${court.courtIndex}`}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {court.courtLabel}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {court.slots.map((slot) => {
                    const clickable = isClickable(mode, slot, interactive);
                    const titleParts = [
                      slot.projectedSource === "other"
                        ? "Otra categoría (misma cancha)"
                        : STATUS_LABEL[slot.status],
                      `${slot.startTime}–${slot.endTime}`,
                      slot.pairLabel,
                      slot.blockReason === "knockout"
                        ? "Reservado fase intermedia"
                        : null,
                      slot.projectedPhase && slot.projectedSource !== "other"
                        ? `Fase: ${slot.projectedPhase}`
                        : null,
                    ].filter(Boolean);

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!clickable}
                        title={titleParts.join(" · ")}
                        aria-label={`${court.courtLabel} ${slot.startTime} ${
                          slot.projectedSource === "other"
                            ? "Otra categoría"
                            : STATUS_LABEL[slot.status]
                        }`}
                        onClick={() => clickable && onToggleSlot?.(slot)}
                        className={cn(
                          "flex h-10 min-w-10 flex-col items-center justify-center rounded-md border px-1.5 text-[10px] leading-tight transition-colors",
                          cellClass(
                            slot.status,
                            slot.projectedPhase,
                            slot.projectedSource,
                          ),
                          clickable && "cursor-pointer",
                          !clickable && "cursor-default opacity-95",
                        )}
                      >
                        <span className="font-semibold tabular-nums">
                          {slot.startTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("inline-block size-3 rounded-sm border", className)}
        aria-hidden
      />
      {label}
    </span>
  );
}
