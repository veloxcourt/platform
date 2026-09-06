"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CourtDayRule, CourtDaySlot } from "@/modules/tournaments/domain/court-day-slots";
import {
  SlotRuleGrid,
  type SlotRuleGridCategory,
} from "./slot-rule-grid";

export function ChangeZoneTimeDialog({
  open,
  onOpenChange,
  zoneLabel,
  rules,
  categories,
  selectedSlot,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoneLabel: string;
  rules: CourtDayRule[];
  categories: SlotRuleGridCategory[];
  selectedSlot?: {
    playDate: string;
    startTime: string;
    courtIndex: number | null;
  } | null;
  onSelect: (slot: CourtDaySlot) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Elegir día, horario y cancha</DialogTitle>
          <DialogDescription>
            Partido de {zoneLabel}. Tocá un slot: se cargan las tres cosas
            juntas. Verde es libre; naranja está ocupado. Se puede elegir uno
            ocupado: el choque se marca en la zona.
          </DialogDescription>
        </DialogHeader>

        <SlotRuleGrid
          mode="simulation"
          rules={rules}
          categories={categories}
          phaseLegend={false}
          showMineCount={false}
          selectedSlot={selectedSlot}
          onSelectSlot={onSelect}
        />
      </DialogContent>
    </Dialog>
  );
}
