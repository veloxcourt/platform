"use client";

import { useEffect, useState } from "react";

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
import type { TournamentListItem } from "@/modules/tournaments/domain/types";

export function CloneTournamentDialog({
  tournament,
  includePairs,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  tournament: TournamentListItem | null;
  includePairs: boolean;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open && tournament) {
      setName("");
    }
  }, [open, tournament]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    onConfirm(trimmed);
  }

  if (!tournament) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {includePairs ? "Clonar torneo completo" : "Clonar torneo sin parejas"}
          </DialogTitle>
          <DialogDescription>
            {includePairs
              ? "Se copia categorías, configuración y parejas. Poné un nombre distinto para no confundirlo con el original."
              : "Se copia categorías y configuración, sin inscripciones. Poné un nombre distinto para no confundirlo con el original."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="text-sm text-muted-foreground">
            Original: <span className="font-medium text-foreground">{tournament.name}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clone-tournament-name">Nombre del nuevo torneo</Label>
            <Input
              id="clone-tournament-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. OCTUBRE 5 - 7ma CABALLEROS"
              maxLength={120}
              autoFocus
              disabled={pending}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Clonando..." : "Crear copia"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
