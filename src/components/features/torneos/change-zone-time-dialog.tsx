"use client";

import { useEffect, useState } from "react";

import {
  closingMinutes,
  minutesToTime,
  timeToMinutes,
} from "@/modules/bookings/domain/rules";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  insertOffGridSlotsIntoRules,
  type CourtDayRule,
  type CourtDaySlot,
} from "@/modules/tournaments/domain/court-day-slots";
import type {
  PlayDayWindowDelta,
  PlayDayWindowEdge,
} from "@/modules/tournaments/domain/play-day-slots";
import {
  SlotRuleGrid,
  type SlotRuleGridCategory,
} from "./slot-rule-grid";

const DAY_MINUTES = 24 * 60;

function clockFromMinutes(total: number) {
  return minutesToTime(((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);
}

function applyManualStart(slot: CourtDaySlot, startTime: string): CourtDaySlot {
  const duration = Math.max(
    0,
    closingMinutes(slot.startTime, slot.endTime) - timeToMinutes(slot.startTime),
  );
  const onGrid = slot.startTime === startTime;
  return {
    ...slot,
    id: onGrid ? slot.id : `${slot.playDate}:${slot.courtIndex}:manual:${startTime}`,
    startTime,
    endTime: clockFromMinutes(timeToMinutes(startTime) + duration),
    slotIndex: onGrid ? slot.slotIndex : timeToMinutes(startTime),
  };
}

function parseClockParts(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return {
    hour: String(Math.min(23, Math.max(0, Number.parseInt(hour, 10) || 0))),
    minute: String(Math.min(59, Math.max(0, Number.parseInt(minute, 10) || 0))),
  };
}

export function ChangeZoneTimeDialog({
  open,
  onOpenChange,
  zoneLabel,
  description,
  rules,
  categories,
  selectedSlot,
  onSelect,
  onAdjustPlayDay,
  canAdjustPlayDay,
  adjustDisabled = false,
  hideZoneMatches = false,
  onHideZoneMatchesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoneLabel: string;
  description?: string;
  rules: CourtDayRule[];
  categories: SlotRuleGridCategory[];
  selectedSlot?: {
    playDate: string;
    startTime: string;
    courtIndex: number | null;
  } | null;
  onSelect: (slot: CourtDaySlot) => void;
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
  hideZoneMatches?: boolean;
  onHideZoneMatchesChange?: (hide: boolean) => void;
}) {
  const [editSlotTimes, setEditSlotTimes] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<CourtDaySlot | null>(null);
  const [hour, setHour] = useState("00");
  const [minute, setMinute] = useState("00");

  useEffect(() => {
    if (open) return;
    setEditSlotTimes(false);
    setPendingSlot(null);
  }, [open]);

  function startManualEdit(slot: CourtDaySlot) {
    const parts = parseClockParts(slot.startTime);
    setPendingSlot(slot);
    setHour(parts.hour.padStart(2, "0"));
    setMinute(parts.minute.padStart(2, "0"));
  }

  function handleSelect(slot: CourtDaySlot) {
    if (editSlotTimes) {
      startManualEdit(slot);
      return;
    }
    onSelect(slot);
  }

  function confirmManualTime() {
    if (!pendingSlot) return;
    const nextHour = Math.min(23, Math.max(0, Number.parseInt(hour, 10) || 0));
    const nextMinute = Math.min(
      59,
      Math.max(0, Number.parseInt(minute, 10) || 0),
    );
    const startTime = `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    onSelect(applyManualStart(pendingSlot, startTime));
    setPendingSlot(null);
  }

  const displayRules = insertOffGridSlotsIntoRules(rules, [
    selectedSlot ?? {},
    pendingSlot
      ? {
          playDate: pendingSlot.playDate,
          startTime: clockFromMinutes(
            (Number.parseInt(hour, 10) || 0) * 60 +
              (Number.parseInt(minute, 10) || 0),
          ),
          courtIndex: pendingSlot.courtIndex,
        }
      : {},
  ]);

  const highlightedSlot = pendingSlot
    ? {
        playDate: pendingSlot.playDate,
        startTime: clockFromMinutes(
          (Number.parseInt(hour, 10) || 0) * 60 +
            (Number.parseInt(minute, 10) || 0),
        ),
        courtIndex: pendingSlot.courtIndex,
      }
    : selectedSlot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Elegir día, horario y cancha</DialogTitle>
          <DialogDescription>
            {description ??
              `Partido de ${zoneLabel}. Tocá un slot: se cargan las tres cosas juntas. Verde es libre; naranja está ocupado. Se puede elegir uno ocupado: el choque se marca en la zona. Los + / − alargan o recortan el día (queda guardado como en Configuración).`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {onHideZoneMatchesChange ? (
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <Checkbox
                checked={hideZoneMatches}
                onCheckedChange={(value) =>
                  onHideZoneMatchesChange(value === true)
                }
                aria-label="Ocultar partidos de zona"
              />
              Ocultar partidos de zona
            </label>
          ) : null}
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
            <Checkbox
              checked={editSlotTimes}
              onCheckedChange={(value) => {
                const next = value === true;
                setEditSlotTimes(next);
                if (!next) {
                  setPendingSlot(null);
                  return;
                }
                if (
                  !selectedSlot?.playDate ||
                  !selectedSlot.startTime ||
                  selectedSlot.courtIndex == null
                ) {
                  return;
                }
                const existing = displayRules
                  .find((rule) => rule.playDate === selectedSlot.playDate)
                  ?.courts.find(
                    (court) => court.courtIndex === selectedSlot.courtIndex,
                  )
                  ?.slots.find(
                    (slot) => slot.startTime === selectedSlot.startTime,
                  );
                startManualEdit(
                  existing ?? {
                    id: `${selectedSlot.playDate}:${selectedSlot.courtIndex}:manual:${selectedSlot.startTime}`,
                    playDate: selectedSlot.playDate,
                    courtIndex: selectedSlot.courtIndex,
                    slotIndex: timeToMinutes(selectedSlot.startTime),
                    startTime: selectedSlot.startTime,
                    endTime: clockFromMinutes(
                      timeToMinutes(selectedSlot.startTime) +
                        (displayRules.find(
                          (rule) => rule.playDate === selectedSlot.playDate,
                        )?.slotMinutes ?? 30),
                    ),
                    status: "free",
                  },
                );
              }}
              aria-label="Editar Horarios Slots"
            />
            Editar Horarios Slots
          </label>
        </div>

        {editSlotTimes && pendingSlot ? (
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
            <p className="w-full text-sm text-muted-foreground">
              Cancha {pendingSlot.courtIndex + 1} · horario actual{" "}
              {selectedSlot?.startTime || pendingSlot.startTime}. Cargá hora y
              minutos.
            </p>
            <div className="grid gap-1">
              <Label htmlFor="slot-hour">Hora</Label>
              <Input
                id="slot-hour"
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                className="w-16 text-center tabular-nums"
                value={hour}
                onChange={(event) => setHour(event.target.value)}
                aria-label="Hora"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="slot-minute">Minutos</Label>
              <Input
                id="slot-minute"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                className="w-16 text-center tabular-nums"
                value={minute}
                onChange={(event) => setMinute(event.target.value)}
                aria-label="Minutos"
              />
            </div>
            <Button type="button" onClick={confirmManualTime}>
              Cargar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingSlot(null)}
            >
              Cancelar
            </Button>
          </div>
        ) : editSlotTimes ? (
          <p className="text-sm text-muted-foreground">
            Tocá un slot y cargá hora y minutos. Día y cancha se mantienen.
          </p>
        ) : null}

        <SlotRuleGrid
          mode="simulation"
          rules={displayRules}
          categories={categories}
          phaseLegend={false}
          showMineCount={false}
          selectedSlot={highlightedSlot}
          onSelectSlot={handleSelect}
          onAdjustPlayDay={onAdjustPlayDay}
          canAdjustPlayDay={canAdjustPlayDay}
          adjustDisabled={adjustDisabled}
        />
      </DialogContent>
    </Dialog>
  );
}
