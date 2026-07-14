"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isSumaGender,
  SUM_CATEGORY_VALUES,
  TOURNAMENT_CATEGORY_GENDER_LABELS,
  TOURNAMENT_CATEGORY_GENDER_VALUES,
  type TournamentCategoryGender,
} from "@/modules/tournaments/domain/category-schema";
import { createCategoryAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/categorias/actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function defaultLevel(
  gender: TournamentCategoryGender,
  levels: string[],
): string {
  if (isSumaGender(gender)) return SUM_CATEGORY_VALUES[0];
  return levels[0] ?? "";
}

export function AddCategoryDialog({
  clubSlug,
  tournamentId,
  levels,
  open,
  onOpenChange,
  onAdded,
}: {
  clubSlug: string;
  tournamentId: string;
  levels: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [gender, setGender] = useState<TournamentCategoryGender>("FEMENINA");
  const [level, setLevel] = useState("");
  const [isPending, startTransition] = useTransition();
  const isSuma = isSumaGender(gender);

  useEffect(() => {
    if (!open) return;
    setGender("FEMENINA");
    setLevel(defaultLevel("FEMENINA", levels));
  }, [open, levels]);

  function handleGenderChange(nextGender: TournamentCategoryGender) {
    setGender(nextGender);
    setLevel(defaultLevel(nextGender, levels));
  }

  function submit() {
    if (!level) {
      toast.error(isSuma ? "Elegí el valor de suma" : "Elegí el nivel de la categoría");
      return;
    }

    startTransition(async () => {
      const result = await createCategoryAction(clubSlug, tournamentId, {
        gender,
        level,
      });
      if (result.ok) {
        toast.success("Categoría creada");
        onOpenChange(false);
        onAdded();
      } else {
        toast.error("No se pudo crear la categoría", {
          description: result.error,
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar categoría</DialogTitle>
          <DialogDescription>
            Cada categoría compite por separado con su propia configuración y
            parejas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-gender">Género</Label>
            <select
              id="category-gender"
              className={SELECT_CLASS}
              value={gender}
              onChange={(e) =>
                handleGenderChange(e.target.value as TournamentCategoryGender)
              }
            >
              {TOURNAMENT_CATEGORY_GENDER_VALUES.map((value) => (
                <option key={value} value={value}>
                  {TOURNAMENT_CATEGORY_GENDER_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-level">{isSuma ? "Suma" : "Nivel"}</Label>
            <select
              id="category-level"
              className={SELECT_CLASS}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {isSuma ? (
                SUM_CATEGORY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))
              ) : levels.length === 0 ? (
                <option value="">Sin niveles configurados</option>
              ) : (
                levels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))
              )}
            </select>
            {!isSuma && (
              <p className="text-xs text-muted-foreground">
                Los niveles se configuran en Turnos → Configuración.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button onClick={submit} disabled={isPending || !level}>
              {isPending ? "Guardando..." : "Crear categoría"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
