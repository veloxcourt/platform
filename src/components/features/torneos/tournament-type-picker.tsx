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

const TYPE_ICON_STYLE: Record<TournamentType, string> = {
  AMERICANO: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200",
  ZONAS: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  ELIMINACION_DIRECTA:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  PAREJAS_SORTEADAS:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  MIXTO: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  RELAMPAGO:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200",
};

const TYPE_CARD_HOVER: Record<TournamentType, string> = {
  AMERICANO: "hover:border-teal-300 hover:bg-teal-50/60 dark:hover:border-teal-800 dark:hover:bg-teal-950/20",
  ZONAS: "hover:border-sky-300 hover:bg-sky-50/60 dark:hover:border-sky-800 dark:hover:bg-sky-950/20",
  ELIMINACION_DIRECTA:
    "hover:border-violet-300 hover:bg-violet-50/60 dark:hover:border-violet-800 dark:hover:bg-violet-950/20",
  PAREJAS_SORTEADAS:
    "hover:border-amber-300 hover:bg-amber-50/60 dark:hover:border-amber-800 dark:hover:bg-amber-950/20",
  MIXTO: "hover:border-rose-300 hover:bg-rose-50/60 dark:hover:border-rose-800 dark:hover:bg-rose-950/20",
  RELAMPAGO:
    "hover:border-orange-300 hover:bg-orange-50/60 dark:hover:border-orange-800 dark:hover:bg-orange-950/20",
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
                  TYPE_CARD_HOVER[item.id],
                  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-lg",
                      TYPE_ICON_STYLE[item.id],
                    )}
                  >
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
