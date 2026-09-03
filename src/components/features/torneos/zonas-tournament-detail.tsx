"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ClipboardList,
  Copy,
  GitBranch,
  Grid3x3,
  Info,
  LayoutList,
  Scale,
  Settings2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { formatShortDate } from "@/lib/date";
import type { CatalogCategory } from "@/modules/herramientas/domain/calendario-torneos";
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
import { StableTabButton } from "@/components/ui/stable-tab-button";
import { TournamentConfigTabs } from "./tournament-config-tabs";
import { TournamentEditForm } from "./tournament-form-dialog";
import { TournamentZonesPanel } from "./tournament-zones-panel";
import { ZonesMatchGridPanel } from "./zones-match-grid-panel";
import { ZonesMatchRulePanel } from "./zones-match-rule-panel";
import { useTournamentReadOnly } from "./tournament-mode-context";

const STATUS_VARIANT: Record<
  CreateTournamentValues["status"],
  "secondary" | "default" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  OPEN: "default",
  CLOSED: "outline",
  FINISHED: "outline",
};

type TournamentTab =
  | "info"
  | "inscripciones"
  | "zonas"
  | "configuracion"
  | "fase-intermedia"
  | "fase-final";

const REGLA_PARTIDOS_TAB = "regla-partidos";
const GRILLA_TAB = "grilla";
const ZONAS_TOOL_TABS = new Set([REGLA_PARTIDOS_TAB, GRILLA_TAB]);

const TABS: {
  id: TournamentTab;
  label: string;
  icon: typeof Info;
}[] = [
  { id: "info", label: "Info", icon: Info },
  { id: "configuracion", label: "Configuración", icon: Settings2 },
  { id: "inscripciones", label: "Inscripciones", icon: ClipboardList },
  { id: "zonas", label: "Zonas", icon: Grid3x3 },
  { id: "fase-intermedia", label: "Fase Intermedia", icon: GitBranch },
  { id: "fase-final", label: "Fase Final", icon: Trophy },
];

export function ZonasTournamentDetail({
  clubSlug,
  currency,
  tournament,
  catalogCategories,
  players,
  config,
  courtCount,
}: {
  clubSlug: string;
  currency: string;
  tournament: ZonasTournamentDetail;
  catalogCategories: CatalogCategory[];
  players: PlayerRef[];
  config: TournamentConfig | null;
  courtCount: number;
}) {
  const router = useRouter();
  const readOnly = useTournamentReadOnly();
  const [activeTab, setActiveTab] = useState<TournamentTab>("inscripciones");
  const [categoryFilterId, setCategoryFilterId] = useState<string>(
    () => tournament.categories[0]?.id ?? "",
  );
  const [zonasSubTab, setZonasSubTab] = useState<string>(
    () => tournament.categories[0]?.id ?? REGLA_PARTIDOS_TAB,
  );

  // Siempre una categoría concreta: no mezclar listados.
  useEffect(() => {
    if (tournament.categories.length === 0) {
      if (categoryFilterId) setCategoryFilterId("");
      if (!ZONAS_TOOL_TABS.has(zonasSubTab)) {
        setZonasSubTab(REGLA_PARTIDOS_TAB);
      }
      return;
    }
    const stillValid = tournament.categories.some(
      (c) => c.id === categoryFilterId,
    );
    if (!stillValid) {
      const first = tournament.categories[0]!.id;
      setCategoryFilterId(first);
      if (!ZONAS_TOOL_TABS.has(zonasSubTab)) setZonasSubTab(first);
    }
  }, [tournament.categories, categoryFilterId, zonasSubTab]);

  const selectedCategory =
    tournament.categories.find((c) => c.id === categoryFilterId) ?? null;

  function copyPublicLink() {
    const url = `${window.location.origin}/inscripcion/${tournament.publicSlug}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  const chrome = (
    <>
      <Link
        href={`/${clubSlug}/torneos`}
        className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Volver a torneos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{tournament.name}</h1>
            <Badge variant="outline">Por zonas</Badge>
            <Badge variant={STATUS_VARIANT[tournament.status]}>
              {TOURNAMENT_STATUS_LABELS[tournament.status]}
            </Badge>
            {readOnly && <Badge variant="secondary">Solo lectura</Badge>}
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
      </div>

      <div
        className="mt-3 flex w-full min-w-0 items-center gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Secciones del torneo"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <StableTabButton
              key={tab.id}
              active={active}
              onSelect={() => setActiveTab(tab.id)}
            >
              <Icon />
              {tab.label}
            </StableTabButton>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={copyPublicLink}
        >
          <Copy className="size-4" />
          Copiar link
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex w-full min-w-0 flex-col">
      {activeTab === "configuracion" ? (
        <TournamentConfigTabs
          clubSlug={clubSlug}
          tournamentId={tournament.id}
          categories={tournament.categories}
          catalogCategories={catalogCategories}
          config={config}
          courtCount={courtCount}
          header={chrome}
        />
      ) : (
        <>
          <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b bg-background px-4 pt-4 pb-3">
            {chrome}
            {activeTab === "zonas" ? (
              <div
                className="mt-3 flex w-full min-w-0 items-center gap-2 overflow-x-auto"
                role="tablist"
                aria-label="Categorías de zonas"
              >
                {tournament.categories.map((category) => (
                  <StableTabButton
                    key={category.id}
                    active={zonasSubTab === category.id}
                    onSelect={() => {
                      setCategoryFilterId(category.id);
                      setZonasSubTab(category.id);
                    }}
                  >
                    {category.name}
                  </StableTabButton>
                ))}
                <StableTabButton
                  active={zonasSubTab === REGLA_PARTIDOS_TAB}
                  onSelect={() => setZonasSubTab(REGLA_PARTIDOS_TAB)}
                >
                  <Scale />
                  Regla de Partidos
                </StableTabButton>
                <StableTabButton
                  active={zonasSubTab === GRILLA_TAB}
                  onSelect={() => setZonasSubTab(GRILLA_TAB)}
                >
                  <LayoutList />
                  Grilla
                </StableTabButton>
              </div>
            ) : null}
          </div>
          <div className="w-full min-w-0 overflow-x-clip pt-4">
      {activeTab === "info" ? (
        <Card>
          <CardHeader>
            <CardTitle>Info del torneo</CardTitle>
            <CardDescription>
              Datos generales del torneo. Las categorías se gestionan en
              Configuración.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TournamentEditForm
              clubSlug={clubSlug}
              tournamentType={tournament.type}
              tournament={tournament}
              readOnly={readOnly}
              showTypeBadge
              onSaved={() => router.refresh()}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "inscripciones" ? (
        <Card id="inscripciones">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>
                {selectedCategory
                  ? `Inscripciones · ${selectedCategory.name}`
                  : "Inscripciones"}
              </CardTitle>
              <CardDescription>
                Solo esta categoría. Cambiá con los chips. Para dar de alta usá
                + Inscribir. La pareja queda confirmada cuando ambos jugadores
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
                Agregá una categoría en Configuración → Categorías para empezar
                a inscribir parejas.
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
      ) : null}

      {activeTab === "zonas" ? (
        zonasSubTab === REGLA_PARTIDOS_TAB ? (
          <ZonesMatchRulePanel
            categories={tournament.categories}
            config={config}
            courtCount={courtCount}
          />
        ) : zonasSubTab === GRILLA_TAB ? (
          <ZonesMatchGridPanel
            tournamentName={tournament.name}
            categories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
          />
        ) : tournament.categories.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Zonas</CardTitle>
              <CardDescription>
                Agregá una categoría en Configuración → Categorías para armar
                las zonas.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <TournamentZonesPanel
            clubSlug={clubSlug}
            tournamentId={tournament.id}
            categories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
            courtCount={courtCount}
            initialCategoryId={categoryFilterId || undefined}
            reservations={tournament.slotReservations}
          />
        )
      ) : null}

      {activeTab === "fase-intermedia" || activeTab === "fase-final" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === "fase-intermedia"
                ? "Fase Intermedia"
                : "Fase Final"}
            </CardTitle>
          </CardHeader>
        </Card>
      ) : null}
          </div>
        </>
      )}
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
