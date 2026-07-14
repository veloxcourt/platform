"use client";

import {
  Grid3x3,
  GitBranch,
  Shuffle,
  Users,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  TOURNAMENT_TYPE_CATALOG,
  type TournamentType,
} from "@/modules/tournaments/domain/tournament-types";

const TYPE_ICONS: Record<TournamentType, LucideIcon> = {
  AMERICANO: Shuffle,
  ZONAS: Grid3x3,
  ELIMINACION_DIRECTA: GitBranch,
  PAREJAS_SORTEADAS: Users,
  MIXTO: UserRound,
  RELAMPAGO: Zap,
};

export function TournamentTypePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: TournamentType) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>¿Qué tipo de torneo querés crear?</DialogTitle>
          <DialogDescription>
            Elegí el formato. Después vas a completar nombre, fechas e
            inscripción.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {TOURNAMENT_TYPE_CATALOG.map((item) => {
            const Icon = TYPE_ICONS[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
                  "hover:border-primary/50 hover:bg-muted/40",
                  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  {item.registrationHint}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
