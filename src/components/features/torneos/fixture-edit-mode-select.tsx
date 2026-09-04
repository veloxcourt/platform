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
  disabled = false,
}: {
  clubSlug: string;
  tournamentId: string;
  disabled?: boolean;
}) {
  const { mode, setMode } = useFixtureEditMode();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: FixtureEditMode) {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await setFixtureEditModeAction(
        clubSlug,
        tournamentId,
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
          ? "Modo Manual: ahora podés ajustar día, horario y cancha"
          : "Modo Automático: Actualizar vuelve a generar el armado",
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
      aria-label="Modo de armado"
      title={
        mode === "MANUAL"
          ? "Modo Manual: Actualizar está bloqueada. Cambiá día, horario y cancha a mano."
          : "Modo Automático: Actualizar genera el armado. Para retocar a mano, pasá a Manual."
      }
    >
      <option value="AUTO">{FIXTURE_EDIT_MODE_LABELS.AUTO}</option>
      <option value="MANUAL">{FIXTURE_EDIT_MODE_LABELS.MANUAL}</option>
    </select>
  );
}
