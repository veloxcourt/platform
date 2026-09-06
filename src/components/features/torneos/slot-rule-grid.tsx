"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bindFieldMenuTrigger,
  consumedHoldClick,
  type MenuPoint,
} from "./field-menu-trigger";
import { formatWeekdayName } from "@/lib/date";
import type {
  CourtDayRule,
  CourtDaySlot,
  PreferenceDensityLevel,
  SlotCellStatus,
} from "@/modules/tournaments/domain/court-day-slots";
import {
  formatDaySlotLabel,
  listSelectablePreferenceSlotsForDay,
  mergeRegistrationDaySlots,
  preferenceDensityLabel,
  preferenceDensityLevel,
  slotBoxWidthRem,
  slotDurationMinutes,
} from "@/modules/tournaments/domain/court-day-slots";
import {
  PLAY_DAY_START_MINUTES,
  type PlayDayStartMinutes,
  type PlayDayWindowDelta,
  type PlayDayWindowEdge,
} from "@/modules/tournaments/domain/play-day-slots";
import { EdgeButtons } from "./play-day-slot-ruler";

export type SlotRuleGridMode = "simulation" | "registration";

/// Categorías de la simulación integral: pintan un redondelito en cada slot ocupado.
export interface SlotRuleGridCategory {
  id: string;
  name: string;
  abbreviation?: string | null;
  color: string;
}

const STATUS_LABEL: Record<SlotCellStatus, string> = {
  free: "Libre",
  projected: "Proyectado",
  blocked: "Bloqueado",
  reserved: "Ocupado",
    mine: "Tu preferencia",
};

const SLOT_BOX_CLASS =
  "relative flex h-[3.25rem] w-16 shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border px-1 text-xs leading-tight transition-colors";

function pairVsLabel(
  pair1?: string | null,
  pair2?: string | null,
): string | null {
  if (!pair1 && !pair2) return null;
  return `${pair1 ?? "—"} vs ${pair2 ?? "—"}`;
}

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

const HEAT_CELL_CLASS: Record<PreferenceDensityLevel, string> = {
  empty: "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70",
  low: "border-lime-300 bg-lime-300 dark:border-lime-700 dark:bg-lime-700",
  mid: "border-amber-400 bg-amber-400 dark:border-amber-600 dark:bg-amber-600",
  full: "border-rose-400 bg-rose-500 dark:border-rose-700 dark:bg-rose-600",
};

function heatLevel(slot: CourtDaySlot): PreferenceDensityLevel {
  return preferenceDensityLevel(
    slot.preferenceCount ?? 0,
    slot.courtCapacity ?? 1,
  );
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
  categories,
  onAdjustPlayDay,
  canAdjustPlayDay,
  adjustDisabled = false,
  onSetPlayDayStartMinutes,
  phaseLegend = true,
  onSelectSlot,
  selectedSlot,
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
  /// Simulación integral: identifica con un punto de color qué categoría ocupa cada slot.
  categories?: SlotRuleGridCategory[];
  /// Mismos + / − que en Parámetros: alargan o recortan el rango del día.
  onAdjustPlayDay?: (
    playDate: string,
    edge: PlayDayWindowEdge,
    delta: PlayDayWindowDelta,
  ) => void;
  canAdjustPlayDay?: (
    playDate: string,
    edge: PlayDayWindowEdge,
    delta: PlayDayWindowDelta,
  ) => boolean;
  adjustDisabled?: boolean;
  onSetPlayDayStartMinutes?: (
    playDate: string,
    minutes: PlayDayStartMinutes,
  ) => void;
  /// Si false, oculta Zonas / Intermedia / Final (p. ej. vista de partidos reales).
  phaseLegend?: boolean;
  /// Si está, cualquier slot (libre u ocupado) se puede elegir.
  onSelectSlot?: (slot: CourtDaySlot) => void;
  selectedSlot?: {
    playDate: string;
    startTime: string;
    courtIndex: number | null;
  } | null;
}) {
  const integral = mode === "simulation" && (categories?.length ?? 0) > 0;
  const categoryById = new Map(
    (categories ?? []).map((category) => [category.id, category]),
  );
  const [startMenu, setStartMenu] = useState<{
    x: number;
    y: number;
    playDate: string;
    currentMinutes: number;
  } | null>(null);
  const [slotDetail, setSlotDetail] = useState<{
    x: number;
    y: number;
    courtLabel: string;
    startTime: string;
    endTime: string;
    status: string;
    phase?: string;
    occupants: {
      name: string;
      matchCode?: string | null;
      pairs: string | null;
    }[];
  } | null>(null);
  const startMenuRef = useRef<HTMLDivElement>(null);
  const slotDetailRef = useRef<HTMLDivElement>(null);
  const menuHoldRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startMenu && !slotDetail) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!startMenuRef.current?.contains(target)) {
        setStartMenu(null);
      }
      if (!slotDetailRef.current?.contains(target)) {
        setSlotDetail(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setStartMenu(null);
        setSlotDetail(null);
      }
    }
    function onScroll() {
      setStartMenu(null);
      setSlotDetail(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [startMenu, slotDetail]);

  function openStartMinutesMenu(
    point: MenuPoint,
    playDate: string,
    startTime: string,
  ) {
    if (adjustDisabled || !onSetPlayDayStartMinutes) return;
    const [, minutes = "0"] = startTime.split(":");
    setStartMenu({
      x: point.x,
      y: point.y,
      playDate,
      currentMinutes: Number.parseInt(minutes, 10) || 0,
    });
  }

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
    <>
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
        {mode === "simulation" && phaseLegend ? (
          <>
            <LegendSwatch
              className={cellClass("projected", "zones")}
              label={integral ? "Zonas" : "Zonas (esta categoría)"}
            />
            <LegendSwatch
              className={cellClass("projected", "knockout")}
              label="Intermedia"
            />
            <LegendSwatch
              className={cellClass("projected", "final")}
              label="Final"
            />
            {!integral && (
              <LegendSwatch
                className={cellClass("projected", "zones", "other")}
                label="Otra categoría"
              />
            )}
          </>
        ) : mode === "simulation" ? (
          <LegendSwatch
            className={cellClass("projected", "zones")}
            label="Partido"
          />
        ) : (
          <>
            <LegendSwatch className={cellClass("mine")} label="Tu preferencia" />
            <LegendSwatch
              className={cellClass("blocked")}
              label="Bloqueado (intermedia)"
            />
            <LegendSwatch className={HEAT_CELL_CLASS.empty} label="Sin pedidos" />
            <LegendSwatch className={HEAT_CELL_CLASS.low} label="Poco pedido" />
            <LegendSwatch className={HEAT_CELL_CLASS.mid} label="Pedido" />
            <LegendSwatch className={HEAT_CELL_CLASS.full} label="Saturado" />
          </>
        )}
      </div>

      {integral && (
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {categories?.map((category) => (
            <span key={category.id} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-[15px] rounded-full"
                style={{ backgroundColor: category.color }}
                aria-hidden
              />
              {category.abbreviation || category.name}
            </span>
          ))}
        </div>
      )}

      {rules.map((day) => {
        const daySlotLabel = formatDaySlotLabel(day);
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
              {mode === "simulation" && daySlotLabel
                ? ` · ${daySlotLabel}`
                : ""}
            </span>
          </p>
          {mode === "registration" ? (
            <div className="max-w-full overflow-x-auto">
              <div className="flex w-max flex-nowrap items-end gap-1.5">
              <div className="flex flex-col gap-1">
                <div className="flex flex-nowrap gap-1.5">
                  {daySlots?.map((slot) => {
                    const blocked = slot.status === "blocked";
                    const count = slot.preferenceCount ?? 0;
                    const capacity = slot.courtCapacity ?? 1;
                    const level = blocked ? "empty" : heatLevel(slot);
                    return (
                      <div
                        key={`${slot.id}-heat`}
                        title={
                          blocked
                            ? "Reservado fase intermedia"
                            : preferenceDensityLabel(count, capacity)
                        }
                        aria-hidden
                        className={cn(
                          "h-3.5 min-w-10 rounded-sm border",
                          blocked
                            ? "border-zinc-300 bg-zinc-200/80 dark:border-zinc-700 dark:bg-zinc-800/60"
                            : HEAT_CELL_CLASS[level],
                        )}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-nowrap gap-1.5">
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
                          cellClass(slot.status),
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
              {showDayActions && (
                <div className="flex gap-1.5">
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
                </div>
              )}
              </div>
            </div>
          ) : (
          <div className="space-y-2">
            {day.courts.map((court) => (
              <div
                key={`${day.playDate}-${court.courtIndex}`}
                className="max-w-full overflow-x-auto"
              >
                <div className="flex w-max flex-nowrap items-center gap-1.5">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {court.courtLabel}
                </span>
                {onAdjustPlayDay && (
                  <EdgeButtons
                    side="left"
                    onAdd={() => onAdjustPlayDay(day.playDate, "start", "add")}
                    onRemove={() =>
                      onAdjustPlayDay(day.playDate, "start", "remove")
                    }
                    addDisabled={
                      canAdjustPlayDay
                        ? !canAdjustPlayDay(day.playDate, "start", "add")
                        : false
                    }
                    removeDisabled={
                      canAdjustPlayDay
                        ? !canAdjustPlayDay(day.playDate, "start", "remove")
                        : court.slots.length <= 1
                    }
                    readOnly={adjustDisabled}
                  />
                )}
                <div className="flex flex-nowrap gap-1.5">
                  {court.slots.map((slot) => {
                    if (slot.spanContinuation) return null;
                    const clickable = isClickable(mode, slot, interactive);
                    const canSetStartMinutes =
                      mode === "simulation" &&
                      Boolean(onSetPlayDayStartMinutes) &&
                      !adjustDisabled &&
                      slot.slotIndex === 0;
                    const occupants =
                      slot.occupants && slot.occupants.length > 0
                        ? slot.occupants
                        : slot.projectedCategoryId
                          ? [
                              {
                                categoryId: slot.projectedCategoryId,
                                matchCode: slot.matchCode ?? null,
                                pair1Label: slot.occupants?.[0]?.pair1Label,
                                pair2Label: slot.occupants?.[0]?.pair2Label,
                              },
                            ]
                          : [];
                    const conflict = occupants.length > 1;
                    const slotCategory = slot.projectedCategoryId
                      ? categoryById.get(slot.projectedCategoryId)
                      : undefined;
                    const occupantLines = occupants.map((occupant) => {
                      const name = categoryById.get(occupant.categoryId)?.name;
                      return {
                        name: name ?? "",
                        matchCode: occupant.matchCode,
                        pairs: pairVsLabel(
                          occupant.pair1Label,
                          occupant.pair2Label,
                        ),
                      };
                    });
                    const titleParts = [
                      conflict
                        ? "Choque: dos categorías en la misma cancha y hora"
                        : slot.projectedSource === "other"
                          ? "Otra categoría (misma cancha)"
                          : STATUS_LABEL[slot.status],
                      `${slot.startTime}–${slot.endTime}`,
                      ...occupantLines.flatMap((line) =>
                        [ [line.name, line.matchCode].filter(Boolean).join(" "), line.pairs ].filter(Boolean),
                      ),
                      slot.pairLabel,
                      slot.blockReason === "knockout"
                        ? "Reservado fase intermedia"
                        : null,
                      slot.projectedPhase && slot.projectedSource !== "other"
                        ? `Fase: ${slot.projectedPhase}`
                        : null,
                      canSetStartMinutes
                        ? "Clic derecho o mantené 2 s (tablet/celular): minutos de arranque"
                        : null,
                    ].filter(Boolean);
                    const canInspect =
                      mode === "simulation" && occupants.length > 0;
                    const canPick = Boolean(onSelectSlot);
                    const isSelected =
                      selectedSlot != null &&
                      selectedSlot.playDate === slot.playDate &&
                      selectedSlot.startTime === slot.startTime &&
                      selectedSlot.courtIndex === slot.courtIndex;

                    const duration = slotDurationMinutes(slot);
                    const boxWidthRem = slotBoxWidthRem(duration);

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        style={
                          boxWidthRem != null
                            ? { width: `${boxWidthRem}rem` }
                            : undefined
                        }
                        disabled={
                          !clickable &&
                          !canSetStartMinutes &&
                          !canInspect &&
                          !canPick
                        }
                        title={titleParts.join(" · ")}
                        aria-pressed={isSelected}
                        aria-label={`${court.courtLabel} ${slot.startTime} ${
                          occupantLines
                            .map((line) =>
                              [line.matchCode, line.pairs]
                                .filter(Boolean)
                                .join(" "),
                            )
                            .join(" · ") ||
                          slot.matchCode ||
                          (slotCategory
                            ? slotCategory.name
                            : slot.projectedSource === "other"
                              ? "Otra categoría"
                              : STATUS_LABEL[slot.status])
                        }${isSelected ? " · seleccionado" : ""}`}
                        onClick={(event) => {
                          if (consumedHoldClick(menuHoldRef)) return;
                          if (onSelectSlot) {
                            onSelectSlot(slot);
                            return;
                          }
                          if (clickable) {
                            onToggleSlot?.(slot);
                            return;
                          }
                          if (!canInspect) return;
                          setStartMenu(null);
                          setSlotDetail({
                            x: event.clientX,
                            y: event.clientY,
                            courtLabel: court.courtLabel,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            status: conflict
                              ? "Choque"
                              : STATUS_LABEL[slot.status],
                            phase: slot.projectedPhase,
                            occupants: occupantLines,
                          });
                        }}
                        {...bindFieldMenuTrigger(
                          canSetStartMinutes,
                          (point) =>
                            openStartMinutesMenu(
                              point,
                              day.playDate,
                              slot.startTime,
                            ),
                          menuHoldRef,
                        )}
                        className={cn(
                          SLOT_BOX_CLASS,
                          boxWidthRem != null && "w-auto",
                          canSetStartMinutes && "select-none",
                          conflict
                            ? cellClass("reserved")
                            : cellClass(
                                slot.status,
                                slot.projectedPhase,
                                slot.projectedSource,
                              ),
                          (clickable ||
                            canSetStartMinutes ||
                            canInspect ||
                            canPick) &&
                            "cursor-pointer",
                          isSelected && "slot-selected-flash text-white",
                          !clickable &&
                            !canSetStartMinutes &&
                            !canInspect &&
                            !canPick &&
                            "cursor-default opacity-95",
                        )}
                      >
                        <span className="font-semibold tabular-nums">
                          {slot.startTime}
                        </span>
                        {occupants.length > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold tracking-tight">
                            {occupants.map((occupant) => {
                              const occupantCategory = categoryById.get(
                                occupant.categoryId,
                              );
                              return (
                                <span
                                  key={`${occupant.categoryId}-${occupant.matchCode ?? ""}`}
                                  className="inline-flex items-center gap-0.5"
                                >
                                  {occupantCategory ? (
                                    <span
                                      className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
                                      style={{
                                        backgroundColor: occupantCategory.color,
                                      }}
                                      aria-hidden
                                    />
                                  ) : null}
                                  {occupant.matchCode}
                                </span>
                              );
                            })}
                          </span>
                        ) : slotCategory ? (
                          <span
                            className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
                            style={{ backgroundColor: slotCategory.color }}
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {onAdjustPlayDay && (
                  <EdgeButtons
                    side="right"
                    onAdd={() => onAdjustPlayDay(day.playDate, "end", "add")}
                    onRemove={() =>
                      onAdjustPlayDay(day.playDate, "end", "remove")
                    }
                    addDisabled={
                      canAdjustPlayDay
                        ? !canAdjustPlayDay(day.playDate, "end", "add")
                        : false
                    }
                    removeDisabled={
                      canAdjustPlayDay
                        ? !canAdjustPlayDay(day.playDate, "end", "remove")
                        : court.slots.length <= 1
                    }
                    readOnly={adjustDisabled}
                  />
                )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        );
      })}
    </div>
    {slotDetail ? (
      <div
        ref={slotDetailRef}
        role="dialog"
        aria-label="Detalle del partido"
        className="fixed z-50 min-w-56 max-w-xs rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-md"
        style={{
          left: Math.min(slotDetail.x, window.innerWidth - 260),
          top: Math.min(slotDetail.y, window.innerHeight - 200),
        }}
      >
        <p className="text-xs text-muted-foreground">
          {slotDetail.courtLabel} · {slotDetail.startTime}–{slotDetail.endTime}
        </p>
        <p className="text-xs text-muted-foreground">
          {slotDetail.status}
          {slotDetail.phase ? ` · Fase: ${slotDetail.phase}` : ""}
        </p>
        <div className="mt-2 space-y-2">
          {slotDetail.occupants.map((occupant, index) => (
            <div
              key={`${occupant.name}-${occupant.matchCode ?? index}`}
              className="text-sm"
            >
              <p className="font-medium">
                {[occupant.name, occupant.matchCode]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {occupant.pairs ? (
                <p className="text-sm leading-snug">{occupant.pairs}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Parejas aún no definidas
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    ) : null}
    {startMenu ? (
      <div
        ref={startMenuRef}
        role="menu"
        className="fixed z-50 min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        style={{
          left: Math.min(startMenu.x, window.innerWidth - 180),
          top: Math.min(startMenu.y, window.innerHeight - 180),
        }}
      >
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Minutos de arranque
        </p>
        {PLAY_DAY_START_MINUTES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            role="menuitem"
            className={cn(
              "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
              startMenu.currentMinutes === minutes && "font-medium",
            )}
            onClick={() => {
              onSetPlayDayStartMinutes?.(startMenu.playDate, minutes);
              setStartMenu(null);
            }}
          >
            {minutes} minutos
          </button>
        ))}
      </div>
    ) : null}
    </>
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
