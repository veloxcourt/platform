"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Copy,
  GitBranch,
  Grid3x3,
  Info,
  LayoutList,
  Medal,
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
  calculateZoneQualificationAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
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
import { DailyMatchesPanel } from "./daily-matches-panel";
import { tournamentPlayDayOptions } from "./daily-matches-model";
import { TournamentZonesPanel } from "./tournament-zones-panel";
import { ZonesMatchGridPanel } from "./zones-match-grid-panel";
import { ZonesMatchRulePanel } from "./zones-match-rule-panel";
import { ActualizarConfirmButton } from "./actualizar-confirm-button";
import { ActualizarHoverHint } from "./actualizar-hover-hint";
import {
  FixtureEditModeProvider,
  FixturePersistFlushBinder,
} from "./fixture-edit-mode-context";
import { useTournamentReadOnly } from "./tournament-mode-context";
import {
  buildActualizarConfirmCopy,
  isPhaseManual,
  parseFixtureEditModes,
} from "@/modules/tournaments/domain/fixture-edit-mode";

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
  | "partidos-del-dia"
  | "soporte";

const REGLA_PARTIDOS_TAB = "regla-partidos";
const GRILLA_TAB = "grilla";
const LLAVE_TAB = "llave";
const PARTIDOS_TAB = "partidos";
const ZONAS_TOOL_TABS = new Set([REGLA_PARTIDOS_TAB, GRILLA_TAB]);
const INTERMEDIA_TOOL_TABS = new Set([
  REGLA_PARTIDOS_TAB,
  GRILLA_TAB,
  LLAVE_TAB,
]);
const FINAL_TOOL_TABS = new Set([
  PARTIDOS_TAB,
  REGLA_PARTIDOS_TAB,
  GRILLA_TAB,
  LLAVE_TAB,
]);

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
  { id: "partidos-del-dia", label: "Partidos del día", icon: CalendarDays },
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
  const [isCalculating, startCalculate] = useTransition();
  const [fixtureEditModes, setFixtureEditModes] = useState(() =>
    parseFixtureEditModes(
      tournament.fixtureEditModes,
      tournament.categories.map((category) => category.id),
    ),
  );
  const [zonesPanelKey, setZonesPanelKey] = useState(0);
  const flushPendingPersistsRef = useRef<() => Promise<void>>(async () => {});
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
  const [finalSubTab, setFinalSubTab] = useState<string>(PARTIDOS_TAB);
  const [finalCategoryId, setFinalCategoryId] = useState<string>(
    () => tournament.categories[0]?.id ?? "",
  );
  const playDayOptions = useMemo(
    () => tournamentPlayDayOptions(config),
    [config],
  );
  const [dailySubTab, setDailySubTab] = useState<string>(
    () => tournamentPlayDayOptions(config)[0]?.date ?? "",
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
    if (!FINAL_TOOL_TABS.has(finalSubTab)) {
      setFinalSubTab(PARTIDOS_TAB);
    }
  }, [finalSubTab]);

  useEffect(() => {
    const stillValid = tournament.categories.some(
      (category) => category.id === finalCategoryId,
    );
    if (!stillValid) {
      setFinalCategoryId(tournament.categories[0]?.id ?? "");
    }
  }, [finalCategoryId, tournament.categories]);

  useEffect(() => {
    setFixtureEditModes(
      parseFixtureEditModes(
        tournament.fixtureEditModes,
        tournament.categories.map((category) => category.id),
      ),
    );
  }, [tournament.categories, tournament.fixtureEditModes]);

  useEffect(() => {
    if (playDayOptions.length === 0) {
      if (dailySubTab) setDailySubTab("");
      return;
    }
    const stillValid = playDayOptions.some((day) => day.date === dailySubTab);
    if (!stillValid) setDailySubTab(playDayOptions[0]!.date);
  }, [dailySubTab, playDayOptions]);

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
      await flushPendingPersistsRef.current();
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
      await flushPendingPersistsRef.current();
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

  function handleCalcularClasificacion() {
    startCalculate(async () => {
      await flushPendingPersistsRef.current();
      const result = await calculateZoneQualificationAction(
        clubSlug,
        tournament.id,
      );
      if (!result.ok) {
        toast.error("No se pudo calcular la clasificación", {
          description: result.error,
        });
        return;
      }
      router.refresh();
      toast.success("Clasificación calculada", {
        description: [
          `${result.seedCount} puesto${result.seedCount === 1 ? "" : "s"} definido${result.seedCount === 1 ? "" : "s"}`,
          `${result.categoryCount} categoría${result.categoryCount === 1 ? "" : "s"}`,
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
      await flushPendingPersistsRef.current();
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

  const categoryRefs = tournament.categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  const intermediateRefs = intermediateCategories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  const hasAutoZones = tournament.categories.some(
    (category) => !isPhaseManual(fixtureEditModes, category.id, "zones"),
  );
  const hasAutoIntermediate = intermediateCategories.some(
    (category) => !isPhaseManual(fixtureEditModes, category.id, "intermediate"),
  );
  const hasAutoFinal = tournament.categories.some(
    (category) => !isPhaseManual(fixtureEditModes, category.id, "final"),
  );
  const zonesConfirm = buildActualizarConfirmCopy({
    phase: "zones",
    scope: "all",
    modes: fixtureEditModes,
    categories: categoryRefs,
  });
  const intermediateConfirm = buildActualizarConfirmCopy({
    phase: "intermediate",
    scope: "all",
    modes: fixtureEditModes,
    categories: intermediateRefs,
  });
  const finalConfirm = buildActualizarConfirmCopy({
    phase: "final",
    scope: "all",
    modes: fixtureEditModes,
    categories: categoryRefs,
  });

  return (
    <FixtureEditModeProvider
      modes={fixtureEditModes}
      readOnly={readOnly}
      setModes={setFixtureEditModes}
    >
    <FixturePersistFlushBinder flushRef={flushPendingPersistsRef} />
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
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
          <div className="relative z-30 shrink-0 -mx-4 -mt-4 border-b bg-background px-4 pt-4 pb-3">
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
                    <ActualizarConfirmButton
                      className="shrink-0"
                      pending={isUpdatingAllZones}
                      disabled={!hasAutoZones}
                      heading={
                        !hasAutoZones
                          ? "Actualizar está bloqueada: todas las categorías están en Manual"
                          : hasAnyZonesFixture
                            ? "Vuelve a armar las zonas en Modo Automático"
                            : "Arma las zonas en Modo Automático"
                      }
                      effects={
                        !hasAutoZones
                          ? [
                              "El modo se elige en cada categoría",
                              "Pasá una categoría a Automático para poder rearmarla",
                            ]
                          : zonesConfirm.affects
                      }
                      note={
                        !hasAutoZones
                          ? "El modo de cada categoría está al lado de su propio Actualizar."
                          : "Solo toca las categorías en Automático. El modo de cada una está al lado de su Actualizar."
                      }
                      confirm={zonesConfirm}
                      onConfirm={handleActualizarTodasLasZonas}
                    />
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
                    <ActualizarHoverHint
                      heading="Calcula quién clasifica en todas las categorías"
                      effects={[
                        "Recalcula 1.ª, 2.ª y quién queda afuera con los resultados guardados",
                        "Completa los nombres en intermedia, llaves y grillas de todas las categorías",
                        "No cambia día, horario ni cancha",
                      ]}
                      note="El Calcular de cada categoría, más abajo, solo toca esa categoría."
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={handleCalcularClasificacion}
                        disabled={isCalculating}
                      >
                        <Calculator
                          className={`size-4 ${isCalculating ? "animate-pulse" : ""}`}
                        />
                        Calcular
                      </Button>
                    </ActualizarHoverHint>
                    <ActualizarConfirmButton
                      className="shrink-0"
                      pending={isUpdatingIntermediate}
                      disabled={!hasAutoIntermediate}
                      heading={
                        !hasAutoIntermediate
                          ? "Actualizar está bloqueada: todas las categorías están en Manual"
                          : hasAnyIntermediateFixture
                            ? "Vuelve a armar la intermedia en Modo Automático"
                            : "Arma la intermedia en Modo Automático"
                      }
                      effects={
                        !hasAutoIntermediate
                          ? [
                              "El modo se elige en cada categoría",
                              "Pasá una categoría a Automático para poder rearmarla",
                            ]
                          : intermediateConfirm.affects
                      }
                      note={
                        !hasAutoIntermediate
                          ? "El modo de cada categoría está al lado de su propio Actualizar."
                          : "Solo toca las categorías en Automático. No toca las zonas."
                      }
                      confirm={intermediateConfirm}
                      onConfirm={handleActualizarTodaIntermedia}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
            {activeTab === "fase-final" ? (
              <div className="mt-3 flex w-full min-w-0 flex-col gap-2">
                <div className="flex w-full min-w-0 items-center gap-2">
                  <div
                    className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
                    role="tablist"
                    aria-label="Secciones de fase final"
                  >
                    <StableTabButton
                      active={finalSubTab === PARTIDOS_TAB}
                      onSelect={() => setFinalSubTab(PARTIDOS_TAB)}
                    >
                      <Medal />
                      Partidos
                    </StableTabButton>
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
                      onSelect={() => setFinalSubTab(LLAVE_TAB)}
                    >
                      <Workflow />
                      Llaves
                    </StableTabButton>
                  </div>
                  {!readOnly && tournament.categories.length > 0 ? (
                    <>
                    <ActualizarHoverHint
                      heading="Calcula quién clasifica en todas las categorías"
                      effects={[
                        "Recalcula 1.ª y 2.ª de cada zona con los resultados guardados",
                        "Completa los nombres en cuartos, llaves y grillas",
                        "No cambia día, horario ni cancha",
                      ]}
                      note="El Calcular de cada categoría, más abajo, solo toca esa categoría."
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={handleCalcularClasificacion}
                        disabled={isCalculating}
                      >
                        <Calculator
                          className={`size-4 ${isCalculating ? "animate-pulse" : ""}`}
                        />
                        Calcular
                      </Button>
                    </ActualizarHoverHint>
                    <ActualizarConfirmButton
                      className="shrink-0"
                      pending={isUpdatingFinal}
                      disabled={!hasAutoFinal}
                      heading={
                        !hasAutoFinal
                          ? "Actualizar está bloqueada: todas las categorías están en Manual"
                          : hasAnyFinalFixture
                            ? "Vuelve a armar la fase final en Modo Automático"
                            : "Arma la fase final en Modo Automático"
                      }
                      effects={
                        !hasAutoFinal
                          ? [
                              "El modo se elige en cada categoría",
                              "Pasá una categoría a Automático para poder rearmarla",
                            ]
                          : finalConfirm.affects
                      }
                      note={
                        !hasAutoFinal
                          ? "El modo de cada categoría está al lado de su propio Actualizar."
                          : "Solo toca las categorías en Automático. No toca zonas ni intermedia."
                      }
                      confirm={finalConfirm}
                      onConfirm={handleActualizarFaseFinal}
                    />
                    </>
                  ) : null}
                </div>
                {(finalSubTab === PARTIDOS_TAB ||
                  finalSubTab === LLAVE_TAB) &&
                tournament.categories.length > 0 ? (
                  <div
                    className="flex min-w-0 items-center gap-2 overflow-x-auto"
                    role="tablist"
                    aria-label="Categorías de fase final"
                  >
                    {tournament.categories.map((category) => (
                      <StableTabButton
                        key={category.id}
                        active={finalCategoryId === category.id}
                        onSelect={() => setFinalCategoryId(category.id)}
                      >
                        {category.name}
                      </StableTabButton>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {activeTab === "partidos-del-dia" ? (
              <div
                className="mt-3 flex min-w-0 items-center gap-2 overflow-x-auto"
                role="tablist"
                aria-label="Días del torneo"
              >
                {playDayOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Definí los días de juego en Configuración.
                  </p>
                ) : (
                  playDayOptions.map((day) => (
                    <StableTabButton
                      key={day.date}
                      active={dailySubTab === day.date}
                      onSelect={() => setDailySubTab(day.date)}
                    >
                      {day.label}
                    </StableTabButton>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-clip overflow-y-auto pt-4">
      {activeTab === "soporte" ? <TorneosSoporteView /> : null}

      {activeTab === "info" ? (
        <Card className={STICKY_PANEL_CARD}>
          <CardHeader className={STICKY_PANEL_HEADER}>
            <CardTitle>Info del torneo</CardTitle>
            <CardAction>
              <AyudaButton
                title="Ayuda de info"
                description="Qué se carga en esta pestaña."
              >
                <p>
                  Datos generales del torneo. Las categorías se gestionan en
                  Configuración.
                </p>
              </AyudaButton>
            </CardAction>
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
        <Card id="inscripciones" className={STICKY_PANEL_CARD}>
          <CardHeader className={`${STICKY_PANEL_HEADER} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
            <div className="space-y-1.5">
              <CardTitle>
                {selectedCategory
                  ? `Inscripciones · ${selectedCategory.name}`
                  : "Inscripciones"}
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-start justify-end gap-2">
              {selectedCategory ? (
                <CategoryInscriptionStats category={selectedCategory} />
              ) : null}
              <AyudaButton
                title="Ayuda de inscripciones"
                description="Cómo se inscriben y confirman las parejas."
              >
                <p>
                  Solo esta categoría. Cambiá con los chips. Para dar de alta
                  usá + Inscribir.
                </p>
                <p>
                  La pareja queda confirmada cuando ambos jugadores confirman.
                  Pendiente no entra a zonas; Parcial o Confirmado sí.
                </p>
              </AyudaButton>
            </div>
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
            tournamentName={tournament.name}
            categories={intermediateCategories}
            pairs={tournament.pairs}
            config={config}
            club={club}
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
            categoryId={finalCategoryId}
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
            categoryId={finalCategoryId}
          />
        )
      ) : null}

      {activeTab === "partidos-del-dia" ? (
        playDayOptions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Partidos del día</CardTitle>
              <CardDescription>
                Cargá los días de juego en Configuración para ver los
                enfrentamientos de cada jornada.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <DailyMatchesPanel
            tournamentName={tournament.name}
            dayLabel={
              playDayOptions.find((day) => day.date === dailySubTab)?.label ??
              ""
            }
            categories={tournament.categories}
            pairs={tournament.pairs}
            config={config}
            playDate={dailySubTab}
            club={club}
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
