"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CircleDollarSign,
  Copy,
  CopyPlus,
  Eye,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";
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
import {
  TOURNAMENT_TYPE_LABELS,
  type TournamentType,
} from "@/modules/tournaments/domain/tournament-types";
import { CloneTournamentDialog } from "./clone-tournament-dialog";
import { TournamentFormDialog } from "./tournament-form-dialog";
import { TournamentTypePicker } from "./tournament-type-picker";
import { cloneTournamentAction, deleteTournamentAction } from "@/app/(dashboard)/[clubSlug]/torneos/actions";

const STATUS_BADGE: Record<CreateTournamentValues["status"], string> = {
  DRAFT:
    "border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100",
  OPEN:
    "border-emerald-300/80 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100",
  CLOSED:
    "border-sky-300/80 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100",
  FINISHED:
    "border-violet-300/80 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100",
};

const STATUS_CARD: Record<CreateTournamentValues["status"], string> = {
  DRAFT:
    "border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-background to-background dark:border-amber-900/40 dark:from-amber-950/25",
  OPEN:
    "border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-background to-background dark:border-emerald-900/40 dark:from-emerald-950/25",
  CLOSED:
    "border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-background to-background dark:border-sky-900/40 dark:from-sky-950/25",
  FINISHED:
    "border-violet-200/90 bg-gradient-to-br from-violet-50/90 via-background to-background dark:border-violet-900/40 dark:from-violet-950/25",
};

const STATUS_BAR: Record<CreateTournamentValues["status"], string> = {
  DRAFT: "bg-amber-400",
  OPEN: "bg-emerald-500",
  CLOSED: "bg-sky-500",
  FINISHED: "bg-violet-500",
};

const TYPE_BADGE: Record<TournamentType, string> = {
  AMERICANO:
    "border-teal-300/80 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100",
  ZONAS:
    "border-sky-300/80 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
  ELIMINACION_DIRECTA:
    "border-violet-300/80 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
  PAREJAS_SORTEADAS:
    "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  MIXTO:
    "border-rose-300/80 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
  RELAMPAGO:
    "border-orange-300/80 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100",
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
  const [cloneTarget, setCloneTarget] = useState<{
    tournament: TournamentListItem;
    includePairs: boolean;
  } | null>(null);
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

  function openCloneDialog(
    tournament: TournamentListItem,
    includePairs: boolean,
  ) {
    setCloneTarget({ tournament, includePairs });
  }

  function confirmClone(name: string) {
    if (!cloneTarget) return;
    const { tournament, includePairs } = cloneTarget;
    setCloningId(tournament.id);
    startClone(async () => {
      const result = await cloneTournamentAction(
        clubSlug,
        tournament.id,
        includePairs,
        name,
      );
      setCloningId(null);
      if (!result.ok) {
        toast.error("No se pudo clonar el torneo", {
          description: result.error,
        });
        return;
      }
      setCloneTarget(null);
      toast.success(
        includePairs ? "Torneo clonado completo" : "Torneo clonado sin parejas",
        { description: name },
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
        <Button
          onClick={openNewTournament}
          className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
        >
          <Plus className="size-4" />
          Nuevo torneo
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 py-12 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <span className="grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Trophy className="size-7" />
          </span>
          <div>
            <p className="font-medium">Sin torneos</p>
            <p className="text-sm text-muted-foreground">
              Creá el primer torneo para empezar a recibir inscripciones.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={openNewTournament}
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
          >
            <Plus className="size-4" />
            Crear torneo
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t) => (
            <article
              key={t.id}
              className={cn(
                "relative flex flex-col gap-3 overflow-hidden rounded-xl border p-4 pl-5 shadow-sm transition-shadow hover:shadow-md",
                STATUS_CARD[t.status],
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 w-1",
                  STATUS_BAR[t.status],
                )}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium">{t.name}</h2>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 text-[10px]", TYPE_BADGE[t.type])}
                    >
                      {TOURNAMENT_TYPE_LABELS[t.type]}
                    </Badge>
                  </div>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0", STATUS_BADGE[t.status])}
                >
                  {TOURNAMENT_STATUS_LABELS[t.status]}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5 text-sky-600 dark:text-sky-400" />
                    Fechas
                  </dt>
                  <dd>
                    {formatShortDate(t.startDate)}
                    {t.endDate && t.endDate !== t.startDate
                      ? ` – ${formatShortDate(t.endDate)}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CircleDollarSign className="size-3.5 text-amber-600 dark:text-amber-400" />
                    Inscripción
                  </dt>
                  <dd>
                    {t.fee > 0 ? formatMoney(t.fee, currency) : "Sin cargo"}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    {t.type === "ZONAS" ? "Parejas" : "Inscriptos"}
                  </dt>
                  <dd>
                    {t.registrationCount}
                    {t.confirmedCount > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({t.confirmedCount} confirmados)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Link2 className="size-3.5 text-violet-600 dark:text-violet-400" />
                    Link público
                  </dt>
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
                    onClick={() => openCloneDialog(t, true)}
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
                    onClick={() => openCloneDialog(t, false)}
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
                  variant="destructive"
                  size="sm"
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

      <CloneTournamentDialog
        tournament={cloneTarget?.tournament ?? null}
        includePairs={cloneTarget?.includePairs ?? true}
        open={cloneTarget != null}
        pending={isCloning && cloningId === cloneTarget?.tournament.id}
        onOpenChange={(open) => {
          if (!open && !isCloning) setCloneTarget(null);
        }}
        onConfirm={confirmClone}
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
