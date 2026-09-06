"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CourtDayRule, CourtDaySlot } from "@/modules/tournaments/domain/court-day-slots";
import type {
  PlayDayWindowDelta,
  PlayDayWindowEdge,
} from "@/modules/tournaments/domain/play-day-slots";
import {
  SlotRuleGrid,
  type SlotRuleGridCategory,
} from "./slot-rule-grid";

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

        <SlotRuleGrid
          mode="simulation"
          rules={rules}
          categories={categories}
          phaseLegend={false}
          showMineCount={false}
          selectedSlot={selectedSlot}
          onSelectSlot={onSelect}
          onAdjustPlayDay={onAdjustPlayDay}
          canAdjustPlayDay={canAdjustPlayDay}
          adjustDisabled={adjustDisabled}
        />
      </DialogContent>
    </Dialog>
  );
}
