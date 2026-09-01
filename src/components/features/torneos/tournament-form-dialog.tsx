"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_VALUES,
  type CreateTournamentValues,
} from "@/modules/tournaments/domain/tournament-schema";
import {
  getTournamentTypeMeta,
  type TournamentType,
} from "@/modules/tournaments/domain/tournament-types";
import type { TournamentListItem } from "@/modules/tournaments/domain/types";
import {
  createTournamentAction,
  updateTournamentAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/actions";
import { centsToPesos } from "@/lib/money";
import { todayISO } from "@/lib/date";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type EditableTournament = Pick<
  TournamentListItem,
  | "id"
  | "type"
  | "name"
  | "description"
  | "status"
  | "startDate"
  | "endDate"
  | "fee"
>;

export function TournamentEditForm({
  clubSlug,
  tournamentType,
  tournament = null,
  readOnly = false,
  showTypeBadge = true,
  onCancel,
  onSaved,
}: {
  clubSlug: string;
  tournamentType: TournamentType | null;
  tournament?: EditableTournament | null;
  readOnly?: boolean;
  showTypeBadge?: boolean;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(tournament);
  const effectiveType = tournament?.type ?? tournamentType;
  const typeMeta = effectiveType ? getTournamentTypeMeta(effectiveType) : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [feePesos, setFeePesos] = useState(0);
  const [status, setStatus] =
    useState<CreateTournamentValues["status"]>("DRAFT");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (tournament) {
      setName(tournament.name);
      setDescription(tournament.description ?? "");
      setStartDate(tournament.startDate);
      setEndDate(tournament.endDate ?? "");
      setFeePesos(centsToPesos(tournament.fee));
      setStatus(tournament.status);
      return;
    }
    setName("");
    setDescription("");
    setStartDate(todayISO());
    setEndDate("");
    setFeePesos(0);
    setStatus("DRAFT");
  }, [tournamentType, tournament]);

  function submit() {
    if (!effectiveType) return;
    if (!name.trim()) {
      toast.error("Ingresá el nombre del torneo");
      return;
    }

    startTransition(async () => {
      if (isEdit && tournament) {
        const result = await updateTournamentAction(clubSlug, tournament.id, {
          name: name.trim(),
          description: description.trim(),
          startDate,
          endDate: endDate || null,
          feePesos,
          status,
        });
        if (result.ok) {
          toast.success("Torneo actualizado");
          onSaved();
        } else {
          toast.error("No se pudo actualizar el torneo", {
            description: result.error,
          });
        }
        return;
      }

      const result = await createTournamentAction(clubSlug, {
        type: effectiveType,
        name: name.trim(),
        description: description.trim(),
        startDate,
        endDate: endDate || null,
        feePesos,
        status,
      });
      if (result.ok) {
        toast.success("Torneo creado");
        onSaved();
      } else {
        toast.error("No se pudo crear el torneo", {
          description: result.error,
        });
      }
    });
  }

  if (!effectiveType || !typeMeta) return null;

  return (
    <div className="flex flex-col gap-3">
      {showTypeBadge ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{typeMeta.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {typeMeta.registrationHint}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tournament-name">Nombre</Label>
        <Input
          id="tournament-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Torneo de Verano 2026"
          disabled={readOnly}
          readOnly={readOnly}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tournament-description">Descripción</Label>
        <Input
          id="tournament-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional"
          disabled={readOnly}
          readOnly={readOnly}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tournament-start">Fecha inicio</Label>
          <Input
            id="tournament-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={readOnly}
            readOnly={readOnly}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tournament-end">Fecha fin</Label>
          <Input
            id="tournament-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={readOnly}
            readOnly={readOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tournament-fee">Inscripción ($)</Label>
          <Input
            id="tournament-fee"
            type="number"
            min={0}
            step={1}
            value={feePesos || ""}
            onChange={(e) => setFeePesos(Number(e.target.value) || 0)}
            placeholder="0"
            disabled={readOnly}
            readOnly={readOnly}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tournament-status">Estado</Label>
          <select
            id="tournament-status"
            className={SELECT_CLASS}
            value={status}
            disabled={readOnly}
            onChange={(e) =>
              setStatus(e.target.value as CreateTournamentValues["status"])
            }
          >
            {TOURNAMENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {TOURNAMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            {readOnly ? "Cerrar" : "Cancelar"}
          </Button>
        ) : null}
        {!readOnly && (
          <Button onClick={submit} disabled={isPending}>
            {isPending
              ? isEdit
                ? "Guardando..."
                : "Creando..."
              : isEdit
                ? "Guardar cambios"
                : "Crear torneo"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function TournamentFormDialog({
  clubSlug,
  tournamentType,
  tournament = null,
  readOnly = false,
  open,
  onOpenChange,
  onBack,
  onSaved,
}: {
  clubSlug: string;
  tournamentType: TournamentType | null;
  tournament?: EditableTournament | null;
  readOnly?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack?: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(tournament);
  const effectiveType = tournament?.type ?? tournamentType;
  const typeMeta = effectiveType ? getTournamentTypeMeta(effectiveType) : null;

  if (!open || !effectiveType || !typeMeta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          {!isEdit && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Cambiar tipo
            </button>
          )}
          <DialogTitle>
            {readOnly ? "Ver torneo" : isEdit ? "Editar torneo" : "Nuevo torneo"}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Datos del torneo. En este modo no se puede modificar nada."
              : isEdit
                ? "Corregí nombre, fechas, inscripción o estado."
                : "Completá los datos del torneo."}
          </DialogDescription>
        </DialogHeader>

        <TournamentEditForm
          clubSlug={clubSlug}
          tournamentType={tournamentType}
          tournament={tournament}
          readOnly={readOnly}
          onCancel={() => onOpenChange(false)}
          onSaved={() => {
            onOpenChange(false);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
