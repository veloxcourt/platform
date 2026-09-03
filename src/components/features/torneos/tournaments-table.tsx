"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, CopyPlus, Eye, Pencil, Plus, Search, Trash2, Trophy, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatShortDate } from "@/lib/date";
import { normalizeText } from "@/components/features/turnos/player-combobox";
import type { TournamentListItem } from "@/modules/tournaments/domain/types";
import {
  TOURNAMENT_STATUS_LABELS,
  type CreateTournamentValues,
} from "@/modules/tournaments/domain/tournament-schema";
import { TOURNAMENT_TYPE_LABELS } from "@/modules/tournaments/domain/tournament-types";
import { TournamentFormDialog } from "./tournament-form-dialog";
import { TournamentTypePicker } from "./tournament-type-picker";
import type { TournamentType } from "@/modules/tournaments/domain/tournament-types";
import { cloneTournamentAction, deleteTournamentAction } from "@/app/(dashboard)/[clubSlug]/torneos/actions";

const STATUS_VARIANT: Record<
  CreateTournamentValues["status"],
  "secondary" | "default" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  OPEN: "default",
  CLOSED: "outline",
  FINISHED: "outline",
};

export function TournamentsTable({
  clubSlug,
  currency,
  tournaments,
}: {
  clubSlug: string;
  currency: string;
  tournaments: TournamentListItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TournamentType | null>(null);
  const [editing, setEditing] = useState<TournamentListItem | null>(null);
  const [formReadOnly, setFormReadOnly] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCloning, startClone] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function openNewTournament() {
    setEditing(null);
    setFormReadOnly(false);
    setSelectedType(null);
    setPickerOpen(true);
  }

  function handleTypeSelect(type: TournamentType) {
    setSelectedType(type);
    setFormOpen(true);
  }

  function handleFormBack() {
    setFormOpen(false);
    setPickerOpen(true);
  }

  function openEditTournament(tournament: TournamentListItem) {
    setEditing(tournament);
    setFormReadOnly(false);
    setSelectedType(tournament.type);
    setFormOpen(true);
  }

  function openViewTournament(tournament: TournamentListItem) {
    setEditing(tournament);
    setFormReadOnly(true);
    setSelectedType(tournament.type);
    setFormOpen(true);
  }

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q
      ? tournaments.filter(
          (t) =>
            normalizeText(t.name).includes(q) ||
            normalizeText(t.description ?? "").includes(q),
        )
      : tournaments;
  }, [tournaments, query]);

  function copyPublicLink(slug: string) {
    const url = `${window.location.origin}/inscripcion/${slug}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copiado", {
      description: "El enlace público de inscripción está en el portapapeles.",
    });
  }

  function cloneTournament(tournament: TournamentListItem, includePairs: boolean) {
    setCloningId(tournament.id);
    startClone(async () => {
      const result = await cloneTournamentAction(
        clubSlug,
        tournament.id,
        includePairs,
      );
      setCloningId(null);
      if (!result.ok) {
        toast.error("No se pudo clonar el torneo", {
          description: result.error,
        });
        return;
      }
      toast.success(
        includePairs ? "Torneo clonado completo" : "Torneo clonado sin parejas",
        { description: `${tournament.name} (copia)` },
      );
      router.refresh();
    });
  }

  function removeTournament(tournament: TournamentListItem) {
    const pairsLabel =
      tournament.type === "ZONAS" ? "pareja" : "inscripción";
    const count = tournament.registrationCount;
    const extra =
      count > 0
        ? `\n\nTambién se eliminarán ${count} ${pairsLabel}${count === 1 ? "" : "s"} y toda la configuración.`
        : "\n\nSe eliminará el torneo y su configuración.";
    const ok = window.confirm(
      `¿Eliminar «${tournament.name}»?${extra}\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setDeletingId(tournament.id);
    startDelete(async () => {
      const result = await deleteTournamentAction(clubSlug, tournament.id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error("No se pudo eliminar el torneo", {
          description: result.error,
        });
        return;
      }
      toast.success("Torneo eliminado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar torneo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button onClick={openNewTournament}>
          <Plus className="size-4" />
          Nuevo torneo
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <Trophy className="size-10 text-muted-foreground/60" />
          <div>
            <p className="font-medium">Sin torneos</p>
            <p className="text-sm text-muted-foreground">
              Creá el primer torneo para empezar a recibir inscripciones.
            </p>
          </div>
          <Button variant="outline" onClick={openNewTournament}>
            <Plus className="size-4" />
            Crear torneo
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t) => (
            <article
              key={t.id}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium">{t.name}</h2>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {TOURNAMENT_TYPE_LABELS[t.type]}
                    </Badge>
                  </div>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[t.status]}>
                  {TOURNAMENT_STATUS_LABELS[t.status]}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Fechas</dt>
                  <dd>
                    {formatShortDate(t.startDate)}
                    {t.endDate && t.endDate !== t.startDate
                      ? ` – ${formatShortDate(t.endDate)}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Inscripción</dt>
                  <dd>
                    {t.fee > 0 ? formatMoney(t.fee, currency) : "Sin cargo"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t.type === "ZONAS" ? "Parejas" : "Inscriptos"}
                  </dt>
                  <dd className="flex items-center gap-1">
                    <Users className="size-3.5 text-muted-foreground" />
                    {t.registrationCount}
                    {t.confirmedCount > 0 && (
                      <span className="text-muted-foreground">
                        ({t.confirmedCount} confirmados)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Link público</dt>
                  <dd className="truncate font-mono text-xs">{t.publicSlug}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      (isCloning && cloningId === t.id) ||
                      (isDeleting && deletingId === t.id)
                    }
                    onClick={() => cloneTournament(t, true)}
                    title="Copia el torneo con categorías, configuración y parejas"
                  >
                    <CopyPlus className="size-4" />
                    Clonar completo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      (isCloning && cloningId === t.id) ||
                      (isDeleting && deletingId === t.id)
                    }
                    onClick={() => cloneTournament(t, false)}
                    title="Copia el torneo con categorías y configuración, sin inscripciones"
                  >
                    <UsersRound className="size-4" />
                    Clonar sin parejas
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                {t.type === "ZONAS" ? (
                  <Link
                    href={`/${clubSlug}/torneos/${t.id}?modo=ver`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <Eye className="size-4" />
                    Ver
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openViewTournament(t)}
                  >
                    <Eye className="size-4" />
                    Ver
                  </Button>
                )}
                {t.type === "ZONAS" ? (
                  <Link
                    href={`/${clubSlug}/torneos/${t.id}?modo=editar`}
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    <Pencil className="size-4" />
                    Editar
                  </Link>
                ) : (
                  <Button size="sm" onClick={() => openEditTournament(t)}>
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyPublicLink(t.publicSlug)}
                >
                  <Copy className="size-4" />
                  Copiar link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={
                    (isCloning && cloningId === t.id) ||
                    (isDeleting && deletingId === t.id)
                  }
                  onClick={() => removeTournament(t)}
                  title="Eliminar torneo"
                  aria-label={`Eliminar ${t.name}`}
                >
                  <Trash2 className="size-4" />
                  Eliminar
                </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <TournamentTypePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleTypeSelect}
      />

      <TournamentFormDialog
        clubSlug={clubSlug}
        tournamentType={selectedType}
        tournament={editing}
        readOnly={formReadOnly}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setFormReadOnly(false);
          }
        }}
        onBack={editing ? undefined : handleFormBack}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
