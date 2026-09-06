"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setFixtureEditModeAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import {
  FIXTURE_EDIT_MODE_LABELS,
  type FixtureEditMode,
} from "@/modules/tournaments/domain/fixture-edit-mode";
import { useFixtureEditMode } from "./fixture-edit-mode-context";

export function FixtureEditModeSelect({
  clubSlug,
  tournamentId,
  categoryId,
  categoryName,
  disabled = false,
}: {
  clubSlug: string;
  tournamentId: string;
  categoryId: string;
  categoryName?: string;
  disabled?: boolean;
}) {
  const { mode, setMode } = useFixtureEditMode(categoryId);
  const [isPending, startTransition] = useTransition();
  const label = categoryName ?? "esta categoría";

  function handleChange(next: FixtureEditMode) {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await setFixtureEditModeAction(
        clubSlug,
        tournamentId,
        categoryId,
        next,
      );
      if (!result.ok) {
        setMode(previous);
        toast.error("No se pudo cambiar el modo", {
          description: result.error,
        });
        return;
      }
      toast.success(
        next === "MANUAL"
          ? `Modo Manual en ${label}: ahora podés ajustar a mano`
          : `Modo Automático en ${label}: Actualizar vuelve a generar el armado`,
      );
    });
  }

  return (
    <select
      className="h-7 shrink-0 rounded-lg border border-input bg-background px-2 text-[0.8rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      value={mode}
      disabled={disabled || isPending}
      onChange={(event) =>
        handleChange(event.target.value as FixtureEditMode)
      }
      aria-label={`Modo de armado de ${label}`}
      title={
        mode === "MANUAL"
          ? `Modo Manual solo en ${label}. Vale en Zonas, Intermedia y Final. Las otras categorías no cambian.`
          : `Modo Automático solo en ${label}. Vale en Zonas, Intermedia y Final. Las otras categorías no cambian.`
      }
    >
      <option value="AUTO">{FIXTURE_EDIT_MODE_LABELS.AUTO}</option>
      <option value="MANUAL">{FIXTURE_EDIT_MODE_LABELS.MANUAL}</option>
    </select>
  );
}
