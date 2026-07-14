"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardList,
  Copy,
  Grid3x3,
  Info,
  Pencil,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/money";
import { formatShortDate } from "@/lib/date";
import type { PlayerRef } from "@/modules/bookings/domain/types";
import type {
  TournamentCategoryItem,
  TournamentConfig,
  ZonasTournamentDetail,
} from "@/modules/tournaments/domain/types";
import {
  TOURNAMENT_STATUS_LABELS,
  type CreateTournamentValues,
} from "@/modules/tournaments/domain/tournament-schema";
import { PairsTable } from "./pairs-table";
import { TournamentCategoriesPanel } from "./tournament-categories-panel";
import { TournamentFormDialog } from "./tournament-form-dialog";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<
  CreateTournamentValues["status"],
  "secondary" | "default" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  OPEN: "default",
  CLOSED: "outline",
  FINISHED: "outline",
};

export function ZonasTournamentDetail({
  clubSlug,
  currency,
  tournament,
  levels,
  players,
  config,
  courtCount,
}: {
  clubSlug: string;
  currency: string;
  tournament: ZonasTournamentDetail;
  levels: string[];
  players: PlayerRef[];
  config: TournamentConfig | null;
  courtCount: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [categoryFilterId, setCategoryFilterId] = useState<string>(
    () => tournament.categories[0]?.id ?? "",
  );

  // Siempre una categoría concreta: no mezclar listados.
  useEffect(() => {
    if (tournament.categories.length === 0) {
      if (categoryFilterId) setCategoryFilterId("");
      return;
    }
    const stillValid = tournament.categories.some(
      (c) => c.id === categoryFilterId,
    );
    if (!stillValid) {
      setCategoryFilterId(tournament.categories[0]!.id);
    }
  }, [tournament.categories, categoryFilterId]);

  const selectedCategory =
    tournament.categories.find((c) => c.id === categoryFilterId) ?? null;

  function copyPublicLink() {
    const url = `${window.location.origin}/inscripcion/${tournament.publicSlug}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{tournament.name}</h1>
            <Badge variant="outline">Por zonas</Badge>
            <Badge variant={STATUS_VARIANT[tournament.status]}>
              {TOURNAMENT_STATUS_LABELS[tournament.status]}
            </Badge>
          </div>
          {tournament.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {tournament.description}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {formatShortDate(tournament.startDate)}
            {tournament.endDate && tournament.endDate !== tournament.startDate
              ? ` – ${formatShortDate(tournament.endDate)}`
              : ""}
            {" · "}
            {tournament.fee > 0
              ? formatMoney(tournament.fee, currency)
              : "Sin cargo"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInfoOpen(true)}
          >
            <Info className="size-4" />
            Info
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={tournament.categories.length === 0}
            onClick={() =>
              document
                .getElementById("inscripciones")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <ClipboardList className="size-4" />
            Inscripciones
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={tournament.categories.length === 0}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Grid3x3 className="size-4" />
              Zonas
              <ChevronDown className="size-4 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Zonas por categoría</DropdownMenuLabel>
                {tournament.categories.length === 0 ? (
                  <DropdownMenuItem disabled>
                    Sin categorías cargadas
                  </DropdownMenuItem>
                ) : (
                  tournament.categories.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() =>
                        router.push(
                          `/${clubSlug}/torneos/${tournament.id}/zonas/${category.id}`,
                        )
                      }
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            href={`/${clubSlug}/torneos/${tournament.id}/configuracion`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Settings2 className="size-4" />
            Configuración
          </Link>
          <Button variant="outline" size="sm" onClick={copyPublicLink}>
            <Copy className="size-4" />
            Copiar link
          </Button>
        </div>
      </div>

      <Card id="inscripciones">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>
              {selectedCategory
                ? `Inscripciones · ${selectedCategory.name}`
                : "Inscripciones"}
            </CardTitle>
            <CardDescription>
              Solo esta categoría. Cambiá con los chips. Para dar de alta usá +
              Inscribir. La pareja queda confirmada cuando ambos jugadores
              confirman.
            </CardDescription>
          </div>
          {selectedCategory ? (
            <CategoryInscriptionStats category={selectedCategory} />
          ) : null}
        </CardHeader>
        <CardContent>
          {tournament.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Agregá una categoría en Info para empezar a inscribir parejas.
            </p>
          ) : (
            <PairsTable
              clubSlug={clubSlug}
              tournamentId={tournament.id}
              currency={currency}
              pairs={tournament.pairs}
              players={players}
              categories={tournament.categories}
              config={config}
              courtCount={courtCount}
              reservations={tournament.slotReservations}
              categoryFilterId={categoryFilterId || null}
              onCategoryFilterChange={(id) => {
                if (id) setCategoryFilterId(id);
              }}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="flex max-h-[90vh] w-[min(96vw,56rem)] max-w-[56rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[56rem]">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Info del torneo</DialogTitle>
            <DialogDescription>
              Simulación de capacidad y categorías. Para dar de alta usá +
              Inscribir.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TournamentCategoriesPanel
              clubSlug={clubSlug}
              tournamentId={tournament.id}
              categories={tournament.categories}
              levels={levels}
              config={config}
              courtCount={courtCount}
              showInscriptionStats={false}
              compact
            />
          </div>
        </DialogContent>
      </Dialog>

      <TournamentFormDialog
        clubSlug={clubSlug}
        tournamentType={tournament.type}
        tournament={tournament}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function CategoryInscriptionStats({
  category,
}: {
  category: TournamentCategoryItem;
}) {
  const items = [
    { label: "Inscriptos", value: category.pairCount },
    { label: "Confirmadas", value: category.confirmedCount },
    { label: "Sin compañero", value: category.withoutPartnerCount },
    { label: "Sin zona", value: category.withoutZoneCount },
  ];

  return (
    <div
      className="flex flex-wrap gap-2 sm:justify-end"
      aria-label={`Estadísticas de ${category.name}`}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-[4.75rem] rounded-md border bg-muted/40 px-2.5 py-1.5 text-center"
        >
          <p className="text-[11px] leading-tight text-muted-foreground">
            {item.label}
          </p>
          <p className="text-lg font-semibold leading-none tabular-nums">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

