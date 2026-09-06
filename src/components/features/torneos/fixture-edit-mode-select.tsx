"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setFixtureEditModeAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import {
  FIXTURE_EDIT_MODE_LABELS,
  FIXTURE_EDIT_PHASE_LABELS,
  type FixtureEditMode,
  type FixtureEditPhase,
} from "@/modules/tournaments/domain/fixture-edit-mode";
import { useFixtureEditMode } from "./fixture-edit-mode-context";

export function FixtureEditModeSelect({
  clubSlug,
  tournamentId,
  categoryId,
  categoryName,
  phase,
  disabled = false,
}: {
  clubSlug: string;
  tournamentId: string;
  categoryId: string;
  categoryName?: string;
  phase: FixtureEditPhase;
  disabled?: boolean;
}) {
  const { mode, setMode } = useFixtureEditMode(categoryId, phase);
  const [isPending, startTransition] = useTransition();
  const label = categoryName ?? "esta categoría";
  const phaseLabel = FIXTURE_EDIT_PHASE_LABELS[phase];

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
        phase,
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
          ? `Modo Manual en ${phaseLabel} · ${label}`
          : `Modo Automático en ${phaseLabel} · ${label}`,
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
      aria-label={`Modo de armado de ${phaseLabel} de ${label}`}
      title={
        mode === "MANUAL"
          ? `Modo Manual solo en ${phaseLabel} de ${label}. Las otras pestañas no cambian.`
          : `Modo Automático solo en ${phaseLabel} de ${label}. Las otras pestañas no cambian.`
      }
    >
      <option value="AUTO">{FIXTURE_EDIT_MODE_LABELS.AUTO}</option>
      <option value="MANUAL">{FIXTURE_EDIT_MODE_LABELS.MANUAL}</option>
    </select>
  );
}
