"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/components/features/turnos/player-combobox";
import type { TournamentInscriptionsItem } from "@/modules/tournaments/domain/types";

const SORT_DATE = "date";
const SORT_NAME = "name";

function formatTournamentDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function inscribedCount(playerIds: string[]) {
  return new Set(playerIds).size;
}

export function TournamentFilterDialog({
  open,
  onOpenChange,
  tournaments,
  selectedTournamentId,
  selectedCategoryId,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournaments: TournamentInscriptionsItem[];
  selectedTournamentId: string;
  selectedCategoryId: string;
  onApply: (tournamentId: string, categoryId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<typeof SORT_DATE | typeof SORT_NAME>(
    SORT_DATE,
  );
  const [draftTournamentId, setDraftTournamentId] = useState(
    selectedTournamentId,
  );
  const [draftCategoryId, setDraftCategoryId] = useState(selectedCategoryId);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDraftTournamentId(selectedTournamentId);
    setDraftCategoryId(selectedCategoryId);
  }, [open, selectedTournamentId, selectedCategoryId]);

  const options = useMemo(() => {
    const rows = tournaments.map((tournament) => {
      const ids = new Set<string>();
      for (const category of tournament.categories) {
        for (const id of category.playerIds) ids.add(id);
      }
      return {
        id: tournament.id,
        name: tournament.name,
        startDate: tournament.startDate,
        inscribedCount: ids.size,
      };
    });

    const needle = normalizeText(query);
    const filtered = needle
      ? rows.filter(
          (row) =>
            normalizeText(row.name).includes(needle) ||
            formatTournamentDate(row.startDate).includes(query.trim()),
        )
      : rows;

    return filtered.sort((a, b) => {
      if (sort === SORT_NAME) {
        const byName = a.name.localeCompare(b.name, "es", {
          sensitivity: "base",
        });
        if (byName !== 0) return byName;
      }
      const byDate = b.startDate.localeCompare(a.startDate);
      if (byDate !== 0) return byDate;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
  }, [tournaments, query, sort]);

  const draftTournament = useMemo(
    () => tournaments.find((t) => t.id === draftTournamentId) ?? null,
    [tournaments, draftTournamentId],
  );

  function pickTournament(id: string) {
    setDraftTournamentId(id);
    setDraftCategoryId("");
  }

  function accept() {
    onApply(draftTournamentId, draftTournamentId ? draftCategoryId : "");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Elegir torneo</DialogTitle>
          <DialogDescription>
            Elegí un torneo y, si querés, una categoría. Aceptá para filtrar
            los jugadores inscriptos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Filtrar por nombre o fecha..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filtrar listado de torneos"
              autoFocus
            />
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="sm"
              variant={sort === SORT_DATE ? "default" : "outline"}
              onClick={() => setSort(SORT_DATE)}
              aria-pressed={sort === SORT_DATE}
            >
              Por fecha
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sort === SORT_NAME ? "default" : "outline"}
              onClick={() => setSort(SORT_NAME)}
              aria-pressed={sort === SORT_NAME}
            >
              A-Z
            </Button>
          </div>
        </div>

        <ul
          role="listbox"
          aria-label="Torneos"
          className="max-h-56 divide-y overflow-y-auto rounded-xl border"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={draftTournamentId === ""}
              onClick={() => pickTournament("")}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                draftTournamentId === "" && "bg-muted",
              )}
            >
              <span className="font-medium">Todos los torneos</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {tournaments.length}
              </span>
            </button>
          </li>
          {options.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              Ningún torneo coincide con el filtro.
            </li>
          ) : (
            options.map((tournament) => {
              const selected = tournament.id === draftTournamentId;
              return (
                <li key={tournament.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pickTournament(tournament.id)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      selected && "bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium break-words">
                        {tournament.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatTournamentDate(tournament.startDate)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {tournament.inscribedCount}{" "}
                      {tournament.inscribedCount === 1
                        ? "inscripto"
                        : "inscriptos"}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {draftTournament && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Categoría del torneo</p>
            <ul
              role="listbox"
              aria-label="Categorías del torneo"
              className="max-h-48 divide-y overflow-y-auto rounded-xl border"
            >
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={draftCategoryId === ""}
                  onClick={() => setDraftCategoryId("")}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    draftCategoryId === "" && "bg-muted",
                  )}
                >
                  <span className="font-medium">Todas las categorías</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {inscribedCount(
                      draftTournament.categories.flatMap((c) => c.playerIds),
                    )}
                  </span>
                </button>
              </li>
              {draftTournament.categories.map((category) => {
                const selected = category.id === draftCategoryId;
                const count = inscribedCount(category.playerIds);
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setDraftCategoryId(category.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                        selected && "bg-muted",
                      )}
                    >
                      <span className="min-w-0 font-medium break-words">
                        {category.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {count} {count === 1 ? "inscripto" : "inscriptos"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={accept}>
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
