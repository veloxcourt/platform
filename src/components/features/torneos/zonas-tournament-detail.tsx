"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ClipboardList,
  Copy,
  GitBranch,
  Grid3x3,
  Info,
  LayoutList,
  RefreshCw,
  Scale,
  Settings2,
  Trophy,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildAllZonesFixturesAction,
  buildFinalFixtureAction,
  buildIntermediateFixtureAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";

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
import { categoriesWithIntermediatePhase } from "@/modules/tournaments/domain/intermediate-phase";
import { FinalLlavePanel } from "./final-llave-panel";
import { FinalMatchGridPanel } from "./final-match-grid-panel";
import { FinalMatchRulePanel } from "./final-match-rule-panel";
import { FinalPhasePanel } from "./final-phase-panel";
import { IntermediateLlavePanel } from "./intermediate-llave-panel";
import { IntermediateMatchGridPanel } from "./intermediate-match-grid-panel";
import { IntermediateMatchRulePanel } from "./intermediate-match-rule-panel";
import { IntermediatePhasePanel } from "./intermediate-phase-panel";
import { PairsTable } from "./pairs-table";
import { StableTabButton } from "@/components/ui/stable-tab-button";
import { TournamentConfigTabs } from "./tournament-config-tabs";
import { TorneosSoporteView } from "./torneos-soporte-view";
import { TournamentEditForm } from "./tournament-form-dialog";
import { TournamentZonesPanel } from "./tournament-zones-panel";
import { ZonesMatchGridPanel } from "./zones-match-grid-panel";
import { ZonesMatchRulePanel } from "./zones-match-rule-panel";
import { ActualizarHoverHint } from "./actualizar-hover-hint";
import { FixtureEditModeProvider } from "./fixture-edit-mode-context";
import { FixtureEditModeSelect } from "./fixture-edit-mode-select";
import { useTournamentReadOnly } from "./tournament-mode-context";
import { parseFixtureEditMode } from "@/modules/tournaments/domain/fixture-edit-mode";

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
  | "fase-final"
  | "soporte";

const REGLA_PARTIDOS_TAB = "regla-partidos";
const GRILLA_TAB = "grilla";
const LLAVE_TAB = "llave";
const ZONAS_TOOL_TABS = new Set([REGLA_PARTIDOS_TAB, GRILLA_TAB]);
const INTERMEDIA_TOOL_TABS = new Set([
  REGLA_PARTIDOS_TAB,
  GRILLA_TAB,
  LLAVE_TAB,
]);
const FINAL_TOOL_TABS = new Set([REGLA_PARTIDOS_TAB, GRILLA_TAB, LLAVE_TAB]);

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
  club,
  tournament,
  catalogCategories,
  players,
  config,
  courtCount,
}: {
  clubSlug: string;
  currency: string;
  club?: {
    name: string;
    logoUrl?: string | null;
    locality?: string | null;
    address?: string | null;
  };
  tournament: ZonasTournamentDetail;
  catalogCategories: CatalogCategory[];
  players: PlayerRef[];
  config: TournamentConfig | null;
  courtCount: number;
}) {
  const router = useRouter();
  const readOnly = useTournamentReadOnly();
  const [isUpdatingAllZones, startUpdateAllZones] = useTransition();
  const [isUpdatingIntermediate, startUpdateIntermediate] = useTransition();
  const [isUpdatingFinal, startUpdateFinal] = useTransition();
  const [fixtureEditMode, setFixtureEditMode] = useState(() =>
    parseFixtureEditMode(tournament.fixtureEditMode),
  );
  const [zonesPanelKey, setZonesPanelKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TournamentTab>("inscripciones");
  const [categoryFilterId, setCategoryFilterId] = useState<string>(
    () => tournament.categories[0]?.id ?? "",
  );
  const [zonasSubTab, setZonasSubTab] = useState<string>(
    () => tournament.categories[0]?.id ?? REGLA_PARTIDOS_TAB,
  );
  const [intermediaSubTab, setIntermediaSubTab] = useState<string>(
    () => tournament.categories[0]?.id ?? REGLA_PARTIDOS_TAB,
  );
  const [finalSubTab, setFinalSubTab] = useState<string>(
    () => tournament.categories[0]?.id ?? REGLA_PARTIDOS_TAB,
  );
  const [finalLlaveCategoryId, setFinalLlaveCategoryId] = useState<string>(
    () => tournament.categories[0]?.id ?? "",
  );

  const intermediateCategories = useMemo(
    () =>
      categoriesWithIntermediatePhase(
        tournament.categories,
        tournament.pairs,
        config,
      ),
    [config, tournament.categories, tournament.pairs],
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

  useEffect(() => {
    if (INTERMEDIA_TOOL_TABS.has(intermediaSubTab)) return;
    const stillValid = intermediateCategories.some(
      (category) => category.id === intermediaSubTab,
    );
    if (!stillValid) {
      setIntermediaSubTab(
        intermediateCategories[0]?.id ?? REGLA_PARTIDOS_TAB,
      );
    }
  }, [intermediateCategories, intermediaSubTab]);

  useEffect(() => {
    if (FINAL_TOOL_TABS.has(finalSubTab)) return;
    const stillValid = tournament.categories.some(
      (category) => category.id === finalSubTab,
    );
    if (!stillValid) {
      setFinalSubTab(tournament.categories[0]?.id ?? REGLA_PARTIDOS_TAB);
    }
  }, [finalSubTab, tournament.categories]);

  useEffect(() => {
    const stillValid = tournament.categories.some(
      (category) => category.id === finalLlaveCategoryId,
    );
    if (!stillValid) {
      setFinalLlaveCategoryId(tournament.categories[0]?.id ?? "");
    }
  }, [finalLlaveCategoryId, tournament.categories]);

  useEffect(() => {
    setFixtureEditMode(parseFixtureEditMode(tournament.fixtureEditMode));
  }, [tournament.fixtureEditMode]);

  const selectedCategory =
    tournament.categories.find((c) => c.id === categoryFilterId) ?? null;

  const hasAnyZonesFixture = Boolean(
    config?.categories.some((category) => category.zonesFixture?.zones.length),
  );
  const hasAnyIntermediateFixture = Boolean(
    config?.categories.some(
      (category) => category.intermediateFixture?.rounds.length,
    ),
  );
  const hasAnyFinalFixture = Boolean(
    config?.categories.some((category) => category.finalFixture?.rounds.length),
  );

  function handleActualizarTodasLasZonas() {
    startUpdateAllZones(async () => {
      const result = await buildAllZonesFixturesAction(
        clubSlug,
        tournament.id,
      );
      if (!result.ok) {
        toast.error("No se pudieron armar las zonas", {
          description: result.error,
        });
        return;
      }
      setZonesPanelKey((n) => n + 1);
      router.refresh();
      toast.success("Zonas armadas", {
        description: [
          `${result.categoryCount} categoría(s) · ${result.zoneCount} zona(s) · ${result.matchCount} partido(s)`,
          result.warnings[0],
        ]
          .filter(Boolean)
          .join(" · "),
      });
      if (result.warnings.length > 1) {
        for (const warning of result.warnings.slice(1, 4)) {
          toast.message(warning);
        }
      }
    });
  }

  function handleActualizarTodaIntermedia() {
    startUpdateIntermediate(async () => {
      const result = await buildIntermediateFixtureAction(
        clubSlug,
        tournament.id,
      );
      if (!result.ok) {
        toast.error("No se pudo armar la fase intermedia", {
          description: result.error,
        });
        return;
      }
      router.refresh();
      toast.success("Fase intermedia armada", {
        description: [
          `${result.categoryCount} categoría(s) · ${result.matchCount} partido(s)`,
          result.warnings[0],
        ]
          .filter(Boolean)
          .join(" · "),
      });
      if (result.warnings.length > 1) {
        for (const warning of result.warnings.slice(1, 4)) {
          toast.message(warning);
        }
      }
    });
  }

  function handleActualizarFaseFinal() {
    startUpdateFinal(async () => {
      const result = await buildFinalFixtureAction(clubSlug, tournament.id);
      if (!result.ok) {
        toast.error("No se pudo armar la fase final", {
          description: result.error,
        });
        return;
      }
      router.refresh();
      toast.success("Fase final armada", {
        description: [
          `${result.categoryCount} categoría(s) · ${result.matchCount} partido(s)`,
          result.warnings[0],
        ]
          .filter(Boolean)
          .join(" · "),
      });
      if (result.warnings.length > 1) {
        for (const warning of result.warnings.slice(1, 4)) {
          toast.message(warning);
        }
      }
    });
  }

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
        <StableTabButton
          active={activeTab === "soporte"}
          onSelect={() => setActiveTab("soporte")}
          className="ml-auto"
          title="Cómo se arma la llave según la cantidad de parejas"
        >
          <BookOpen />
          Soporte
        </StableTabButton>
      </div>
    </>
  );

  const isManual = fixtureEditMode === "MANUAL";

  return (
    <FixtureEditModeProvider
      mode={fixtureEditMode}
      readOnly={readOnly}
      setMode={setFixtureEditMode}
    >
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
              <div className="mt-3 flex w-full min-w-0 items-center gap-2">
                <div
                  className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
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
                {!readOnly && tournament.categories.length > 0 ? (
                  <>
                    <FixtureEditModeSelect
                      clubSlug={clubSlug}
                      tournamentId={tournament.id}
                    />
                    <ActualizarHoverHint
                      heading={
                        isManual
                          ? "Actualizar está bloqueada en Modo Manual"
                          : hasAnyZonesFixture
                            ? "Vuelve a armar las zonas de todas las categorías"
                            : "Arma las zonas de todas las categorías"
                      }
                      effects={
                        isManual
                          ? [
                              "En Manual no se regeneran zonas ni horarios",
                              "Podés ajustar día, horario, cancha y parejas a mano",
                            ]
                          : [
                              "Reasigna las parejas de cada zona",
                              "Recalcula día, horario y cancha de todos los partidos",
                              "También rearma fase intermedia y fase final",
                            ]
                      }
                      note={
                        isManual
                          ? "Pasá a Modo Automático si querés volver a generar."
                          : hasAnyZonesFixture
                            ? "Pisa los ajustes que hayas hecho a mano. Usalo si cambiaste inscripciones o preferencias; no lo uses si ya acomodaste horarios y querés conservarlos."
                            : "Usalo para completar día, horario y cancha según preferencias."
                      }
                    >
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        onClick={handleActualizarTodasLasZonas}
                        disabled={isUpdatingAllZones || isManual}
                      >
                        <RefreshCw
                          className={`size-4 ${isUpdatingAllZones ? "animate-spin" : ""}`}
                        />
                        Actualizar
                      </Button>
                    </ActualizarHoverHint>
                  </>
                ) : null}
              </div>
            ) : null}
            {activeTab === "fase-intermedia" ? (
              <div className="mt-3 flex w-full min-w-0 items-center gap-2">
              <div
                className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
                role="tablist"
                aria-label="Categorías de fase intermedia"
              >
                {intermediateCategories.map((category) => (
                  <StableTabButton
                    key={category.id}
                    active={intermediaSubTab === category.id}
                    onSelect={() => setIntermediaSubTab(category.id)}
                  >
                    {category.name}
                  </StableTabButton>
                ))}
                <StableTabButton
                  active={intermediaSubTab === REGLA_PARTIDOS_TAB}
                  onSelect={() => setIntermediaSubTab(REGLA_PARTIDOS_TAB)}
                >
                  <Scale />
                  Regla de Partidos
                </StableTabButton>
                <StableTabButton
                  active={intermediaSubTab === GRILLA_TAB}
                  onSelect={() => setIntermediaSubTab(GRILLA_TAB)}
                >
                  <LayoutList />
                  Grilla
                </StableTabButton>
                <StableTabButton
                  active={intermediaSubTab === LLAVE_TAB}
                  onSelect={() => setIntermediaSubTab(LLAVE_TAB)}
                >
                  <Workflow />
                  Llave
                </StableTabButton>
              </div>
                {!readOnly && intermediateCategories.length > 0 ? (
                  <>
                    <FixtureEditModeSelect
                      clubSlug={clubSlug}
                      tournamentId={tournament.id}
                    />
                    <ActualizarHoverHint
                      heading={
                        isManual
                          ? "Actualizar está bloqueada en Modo Manual"
                          : hasAnyIntermediateFixture
                            ? "Vuelve a armar la intermedia de todas las categorías"
                            : "Arma la intermedia de todas las categorías"
                      }
                      effects={
                        isManual
                          ? [
                              "En Manual no se regeneran los cruces",
                              "Podés cambiar el orden de los partidos con las flechas",
                            ]
                          : [
                              "Recalcula día, horario y cancha de todos los cruces intermedios",
                              "También rearma la fase final de todas las categorías",
                            ]
                      }
                      note={
                        isManual
                          ? "Pasá a Modo Automático si querés volver a generar."
                          : "Pisa los ajustes de todas las categorías. El Actualizar de cada categoría solo toca esa."
                      }
                    >
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        onClick={handleActualizarTodaIntermedia}
                        disabled={isUpdatingIntermediate || isManual}
                      >
                        <RefreshCw
                          className={`size-4 ${isUpdatingIntermediate ? "animate-spin" : ""}`}
                        />
                        Actualizar
                      </Button>
                    </ActualizarHoverHint>
                  </>
                ) : null}
              </div>
            ) : null}
            {activeTab === "fase-final" ? (
              <div className="mt-3 flex w-full min-w-0 items-center gap-2">
                <div
                  className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
                  role="tablist"
                  aria-label="Categorías de fase final"
                >
                  {tournament.categories.map((category) => (
                    <StableTabButton
                      key={category.id}
                      active={
                        finalSubTab === LLAVE_TAB
                          ? finalLlaveCategoryId === category.id
                          : finalSubTab === category.id
                      }
                      onSelect={() => {
                        setFinalLlaveCategoryId(category.id);
                        if (finalSubTab !== LLAVE_TAB) {
                          setFinalSubTab(category.id);
                        }
                      }}
                    >
                      {category.name}
                    </StableTabButton>
                  ))}
                  <StableTabButton
                    active={finalSubTab === REGLA_PARTIDOS_TAB}
                    onSelect={() => setFinalSubTab(REGLA_PARTIDOS_TAB)}
                  >
                    <Scale />
                    Regla de Partidos
                  </StableTabButton>
                  <StableTabButton
                    active={finalSubTab === GRILLA_TAB}
                    onSelect={() => setFinalSubTab(GRILLA_TAB)}
                  >
                    <LayoutList />
                    Grilla
                  </StableTabButton>
                  <StableTabButton
                    active={finalSubTab === LLAVE_TAB}
                    onSelect={() => {
                      if (
                        !FINAL_TOOL_TABS.has(finalSubTab) &&
                        finalSubTab
                      ) {
                        setFinalLlaveCategoryId(finalSubTab);
                      }
                      setFinalSubTab(LLAVE_TAB);
                    }}
                  >
                    <Workflow />
                    Llaves
                  </StableTabButton>
                </div>
                {!readOnly && tournament.categories.length > 0 ? (
                  <>
                    <FixtureEditModeSelect
                      clubSlug={clubSlug}
                      tournamentId={tournament.id}
                    />
                    <ActualizarHoverHint
                      heading={
                        isManual
                          ? "Actualizar está bloqueada en Modo Manual"
                          : hasAnyFinalFixture
                            ? "Vuelve a armar la fase final"
                            : "Arma la fase final"
                      }
                      effects={
                        isManual
                          ? [
                              "En Manual no se regeneran los cruces",
                              "Pasá a Automático para volver a generar",
                            ]
                          : [
                              "Recalcula día, horario y cancha de todos los cruces finales",
                              "Aplica a todas las categorías",
                            ]
                      }
                      note={
                        isManual
                          ? "Pasá a Modo Automático si querés volver a generar."
                          : "Pisa los ajustes de todas las categorías. El Actualizar de cada categoría solo toca esa."
                      }
                    >
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        onClick={handleActualizarFaseFinal}
                        disabled={isUpdatingFinal || isManual}
                      >
                        <RefreshCw
                          className={`size-4 ${isUpdatingFinal ? "animate-spin" : ""}`}
                        />
                        Actualizar
                      </Button>
                    </ActualizarHoverHint>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="w-full min-w-0 overflow-x-clip pt-4">
      {activeTab === "soporte" ? <TorneosSoporteView /> : null}

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
            pairs={tournament.pairs}
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
            key={zonesPanelKey}
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

      {activeTab === "fase-intermedia" ? (
        intermediaSubTab === REGLA_PARTIDOS_TAB ? (
          <IntermediateMatchRulePanel
            categories={intermediateCategories}
            zoneCategories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
            courtCount={courtCount}
          />
        ) : intermediaSubTab === GRILLA_TAB ? (
          <IntermediateMatchGridPanel
            tournamentName={tournament.name}
            categories={intermediateCategories}
            zoneCategories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
          />
        ) : intermediaSubTab === LLAVE_TAB ? (
          <IntermediateLlavePanel
            categories={intermediateCategories}
            pairs={tournament.pairs}
            config={config}
          />
        ) : intermediateCategories.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Fase Intermedia</CardTitle>
              <CardDescription>
                Ninguna categoría tiene fase intermedia. Depende de cuántas
                parejas avanzan y de dónde empieza la Fase Final.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <IntermediatePhasePanel
            clubSlug={clubSlug}
            tournamentId={tournament.id}
            categories={intermediateCategories}
            pairs={tournament.pairs}
            config={config}
            courtCount={courtCount}
            categoryId={intermediaSubTab}
          />
        )
      ) : null}

      {activeTab === "fase-final" ? (
        finalSubTab === REGLA_PARTIDOS_TAB ? (
          <FinalMatchRulePanel
            categories={tournament.categories}
            zoneCategories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
            courtCount={courtCount}
          />
        ) : finalSubTab === GRILLA_TAB ? (
          <FinalMatchGridPanel
            tournamentName={tournament.name}
            categories={tournament.categories}
            zoneCategories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
          />
        ) : finalSubTab === LLAVE_TAB ? (
          <FinalLlavePanel
            tournamentName={tournament.name}
            categories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
            categoryId={finalLlaveCategoryId}
            onCategoryChange={setFinalLlaveCategoryId}
            club={club}
          />
        ) : tournament.categories.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Fase Final</CardTitle>
              <CardDescription>
                Agregá una categoría en Configuración → Categorías para armar
                la fase final.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <FinalPhasePanel
            clubSlug={clubSlug}
            tournamentId={tournament.id}
            categories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
            courtCount={courtCount}
            categoryId={finalSubTab}
          />
        )
      ) : null}
          </div>
        </>
      )}
    </div>
    </FixtureEditModeProvider>
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
