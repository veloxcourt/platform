"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CALENDAR_PALETTE,
  type CatalogCategory,
} from "@/modules/herramientas/domain/calendario-torneos";
import type {
  CategoryPhaseConfig,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import type { PlayDayValues } from "@/modules/tournaments/domain/config-schema";
import {
  canShiftPlayDayVisibleWindow,
  setPlayDayStartMinutes,
  shiftPlayDayVisibleWindow,
  type PlayDayStartMinutes,
  type PlayDayWindowDelta,
  type PlayDayWindowEdge,
} from "@/modules/tournaments/domain/play-day-slots";
import {
  breakdownCategorySimulation,
  formatSimulationDuration,
  simulateCategorySchedule,
  type CategoryScheduleSimulation,
} from "@/modules/tournaments/domain/simulate-category-schedule";
import { updatePlayDaysAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/configuracion/actions";
import {
  buildSimulationRuleGrid,
  slotMinutesForSimulationDate,
  summarizeIntegralSimulation,
} from "@/modules/tournaments/domain/court-day-slots";
import type { SimulationCategoryLoad } from "@/modules/tournaments/domain/court-day-slots";
import { downloadSimulationPdf } from "./simulation-pdf";
import { SlotRuleGrid, type SlotRuleGridCategory } from "./slot-rule-grid";
import {
  deleteCategoryAction,
  updateCategorySimulationAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/categorias/actions";
import { AddCategoryDialog } from "./add-category-dialog";
import { useTournamentReadOnly } from "./tournament-mode-context";

type SimulationDraft = {
  enabled: boolean;
  confirmed: string;
};

/// Fila lista para simular: categoría con configuración y resultado propio.
type SimulationRow = {
  category: TournamentCategoryItem;
  categoryConfig: CategoryPhaseConfig;
  result: CategoryScheduleSimulation;
  color: string;
};

function defaultConfirmed(category: TournamentCategoryItem): string {
  if (category.simulationConfirmedCount != null) {
    return String(category.simulationConfirmedCount);
  }
  return String(Math.max(category.confirmedCount, 8));
}

function draftFromCategory(category: TournamentCategoryItem): SimulationDraft {
  return {
    enabled: category.simulationEnabled,
    confirmed: defaultConfirmed(category),
  };
}

function parseConfirmed(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (value.trim() === "" || !Number.isFinite(parsed)) return null;
  return Math.min(256, Math.max(0, parsed));
}

/// Color del punto de la categoría (catálogo del club; si falta, paleta por orden).
function categoryColor(
  category: TournamentCategoryItem,
  index: number,
): string {
  return (
    category.color ?? CALENDAR_PALETTE[index % CALENDAR_PALETTE.length]
  );
}

function phaseSlotMinutes(config: CategoryPhaseConfig, phase: "zones" | "knockout" | "final") {
  return config.phases[phase].matchDurationMin + config.intervalMin;
}

export function TournamentCategoriesPanel({
  clubSlug,
  tournamentId,
  categories,
  catalogCategories,
  config,
  courtCount,
  /// Si false, oculta Inscriptos / Sin compañero / Sin zona (van en Inscripciones).
  showInscriptionStats = true,
  /// Título/descripción más cortos para el diálogo Info.
  compact = false,
}: {
  clubSlug: string;
  tournamentId: string;
  categories: TournamentCategoryItem[];
  catalogCategories: CatalogCategory[];
  config: TournamentConfig | null;
  courtCount: number;
  showInscriptionStats?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const readOnly = useTournamentReadOnly();
  const [addOpen, setAddOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, SimulationDraft>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, draftFromCategory(c)])),
  );
  const [, startTransition] = useTransition();
  const [, startCategoryMutation] = useTransition();
  const [, startPlayDaysMutation] = useTransition();
  const [playDaysDraft, setPlayDaysDraft] = useState<PlayDayValues[] | null>(
    null,
  );
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const playDays = playDaysDraft ?? config?.playDays ?? [];
  const slotMinutes = Math.max(
    1,
    ...(config?.categories.map(
      (category) =>
        category.phases.zones.matchDurationMin + category.intervalMin,
    ) ?? [75]),
  );
  const phaseLoads = (config?.categories ?? []).map((category) => ({
    zonesPlayDates: category.phases.zones.playDates,
    knockoutPlayDates: category.phases.knockout.playDates,
    finalPlayDates: category.phases.final.playDates,
    zonesSlotMinutes: phaseSlotMinutes(category, "zones"),
    knockoutSlotMinutes: phaseSlotMinutes(category, "knockout"),
    finalSlotMinutes: phaseSlotMinutes(category, "final"),
  }));

  function slotMinutesForDate(playDate: string) {
    return slotMinutesForSimulationDate(playDate, phaseLoads, slotMinutes);
  }

  useEffect(() => {
    if (!playDaysDraft || !config) return;
    if (
      JSON.stringify(playDaysDraft) === JSON.stringify(config.playDays)
    ) {
      setPlayDaysDraft(null);
    }
  }, [config, playDaysDraft]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const category of categories) {
        const existing = prev[category.id];
        // Si no hay draft local, o el servidor trae valores distintos sin edición pendiente,
        // sincronizamos desde la DB.
        if (!existing) {
          next[category.id] = draftFromCategory(category);
          continue;
        }
        const serverConfirmed = defaultConfirmed(category);
        const matchesServer =
          existing.enabled === category.simulationEnabled &&
          existing.confirmed === serverConfirmed;
        if (matchesServer) {
          next[category.id] = draftFromCategory(category);
        }
      }
      return next;
    });
  }, [categories]);

  function simulationState(category: TournamentCategoryItem): SimulationDraft {
    return drafts[category.id] ?? draftFromCategory(category);
  }

  function cancelPendingSaves() {
    for (const [id, timer] of Object.entries(saveTimers.current)) {
      clearTimeout(timer);
      delete saveTimers.current[id];
    }
  }

  function persist(
    category: TournamentCategoryItem,
    draft: SimulationDraft,
    options?: { debounceMs?: number },
  ) {
    if (readOnly) return;
    const debounceMs = options?.debounceMs ?? 0;
    const existingTimer = saveTimers.current[category.id];
    if (existingTimer) clearTimeout(existingTimer);

    const run = () => {
      startTransition(async () => {
        const result = await updateCategorySimulationAction(
          clubSlug,
          tournamentId,
          category.id,
          {
            simulationEnabled: draft.enabled,
            simulationConfirmedCount: parseConfirmed(draft.confirmed),
          },
        );
        if (!result.ok) {
          toast.error("No se pudo guardar la simulación", {
            description: result.error,
          });
          return;
        }
        router.refresh();
      });
    };

    if (debounceMs > 0) {
      saveTimers.current[category.id] = setTimeout(run, debounceMs);
    } else {
      run();
    }
  }

  /// La simulación es integral: un solo tilde para todas las categorías del torneo.
  const simulationEnabled = categories.some((c) => simulationState(c).enabled);

  function setSimulationEnabled(enabled: boolean) {
    const next: Record<string, SimulationDraft> = {};
    for (const category of categories) {
      next[category.id] = {
        enabled,
        confirmed:
          simulationState(category).confirmed || defaultConfirmed(category),
      };
    }
    setDrafts((prev) => ({ ...prev, ...next }));
    if (readOnly) return;

    cancelPendingSaves();
    startTransition(async () => {
      for (const category of categories) {
        const result = await updateCategorySimulationAction(
          clubSlug,
          tournamentId,
          category.id,
          {
            simulationEnabled: enabled,
            simulationConfirmedCount: parseConfirmed(
              next[category.id].confirmed,
            ),
          },
        );
        if (!result.ok) {
          toast.error("No se pudo guardar la simulación", {
            description: result.error,
          });
          return;
        }
      }
      router.refresh();
    });
  }

  function setConfirmed(category: TournamentCategoryItem, confirmed: string) {
    const next = { enabled: simulationEnabled, confirmed };
    setDrafts((prev) => ({ ...prev, [category.id]: next }));
    persist(category, next, { debounceMs: 500 });
  }

  function adjustPlayDay(
    playDate: string,
    edge: PlayDayWindowEdge,
    delta: PlayDayWindowDelta,
  ) {
    if (readOnly) return;
    const current = playDays.find((day) => day.date === playDate);
    if (!current) return;
    const nextDay = shiftPlayDayVisibleWindow(
      current,
      slotMinutesForDate(playDate),
      edge,
      delta,
    );
    if (!nextDay) return;
    commitPlayDays(
      playDays.map((day) => (day.date === playDate ? nextDay : day)),
    );
  }

  function setStartMinutes(playDate: string, minutes: PlayDayStartMinutes) {
    if (readOnly) return;
    const current = playDays.find((day) => day.date === playDate);
    if (!current) return;
    const nextDay = setPlayDayStartMinutes(
      current,
      slotMinutesForDate(playDate),
      minutes,
    );
    if (!nextDay) return;
    commitPlayDays(
      playDays.map((day) => (day.date === playDate ? nextDay : day)),
    );
  }

  function commitPlayDays(next: PlayDayValues[]) {
    setPlayDaysDraft(next);
    startPlayDaysMutation(async () => {
      const result = await updatePlayDaysAction(clubSlug, tournamentId, next);
      if (!result.ok) {
        toast.error("No se pudo guardar el rango", {
          description: result.error,
        });
        return;
      }
      router.refresh();
    });
  }

  function removeCategory(category: TournamentCategoryItem) {
    if (category.pairCount > 0) {
      const ok = window.confirm(
        `«${category.name}» tiene ${category.pairCount} inscripción${category.pairCount === 1 ? "" : "es"}.\n\nSi confirmás, se eliminará la categoría y todas sus parejas. Esta acción no se puede deshacer.`,
      );
      if (!ok) return;
    }

    startCategoryMutation(async () => {
      const result = await deleteCategoryAction(
        clubSlug,
        tournamentId,
        category.id,
      );
      if (result.ok) {
        toast.success(
          category.pairCount > 0
            ? "Categoría e inscripciones eliminadas"
            : "Categoría eliminada",
        );
        router.refresh();
      } else {
        toast.error("No se pudo eliminar", { description: result.error });
      }
    });
  }

  const rows = categories.map((category, index) => {
    const sim = simulationState(category);
    const categoryConfig =
      config?.categories.find((c) => c.categoryId === category.id) ?? null;
    const confirmed = parseConfirmed(sim.confirmed);
    const result =
      simulationEnabled && config && categoryConfig && confirmed != null
        ? simulateCategorySchedule(
            confirmed,
            categoryConfig,
            playDays,
            courtCount,
          )
        : null;
    return {
      category,
      sim,
      categoryConfig,
      result,
      color: categoryColor(category, index),
    };
  });

  const simulationRows: SimulationRow[] = rows
    .filter(
      (
        row,
      ): row is typeof row & {
        categoryConfig: CategoryPhaseConfig;
        result: CategoryScheduleSimulation;
      } => Boolean(row.categoryConfig && row.result),
    )
    .map(({ category, categoryConfig, result, color }) => ({
      category,
      categoryConfig,
      result,
      color,
    }));

  const unconfiguredNames = simulationEnabled
    ? rows.filter((row) => !row.categoryConfig).map((row) => row.category.name)
    : [];

  function exportSimulation() {
    if (simulationRows.length === 0 || playDays.length === 0) {
      toast.error("No hay simulación para exportar", {
        description: "Activá Simulación e ingresá confirmadas por categoría.",
      });
      return;
    }
    try {
      const categoryLoads: SimulationCategoryLoad[] = simulationRows.map(
        (row) => ({
          categoryId: row.category.id,
          zonesPlayDates: row.categoryConfig.phases.zones.playDates,
          knockoutPlayDates: row.categoryConfig.phases.knockout.playDates,
          finalPlayDates: row.categoryConfig.phases.final.playDates,
          zoneMatches: row.result.zoneMatches,
          intermediateMatches: row.result.intermediateMatches,
          finalMatches: row.result.finalMatches,
          zonesSlotMinutes: phaseSlotMinutes(row.categoryConfig, "zones"),
          knockoutSlotMinutes: phaseSlotMinutes(row.categoryConfig, "knockout"),
          finalSlotMinutes: phaseSlotMinutes(row.categoryConfig, "final"),
        }),
      );
      const ruleGrid = buildSimulationRuleGrid({
        playDays,
        courtCount,
        zonesSlotMinutes: slotMinutes,
        categoryLoads,
      });
      const summary = summarizeIntegralSimulation(
        ruleGrid,
        simulationRows.map((row) => ({
          categoryId: row.category.id,
          result: row.result,
          zonesPlayDates: row.categoryConfig.phases.zones.playDates,
          knockoutPlayDates: row.categoryConfig.phases.knockout.playDates,
          finalPlayDates: row.categoryConfig.phases.final.playDates,
        })),
        slotMinutes,
      );
      downloadSimulationPdf({
        tournamentName: config?.tournamentName ?? "Torneo",
        courtCount,
        playDayCount: playDays.length,
        rows: simulationRows.map((row) => ({
          id: row.category.id,
          name: row.category.name,
          abbreviation: row.category.abbreviation,
          color: row.color,
          result: row.result,
        })),
        summary,
        rules: ruleGrid,
      });
    } catch (error) {
      toast.error("No se pudo generar el PDF", {
        description:
          error instanceof Error ? error.message : "Error inesperado",
      });
    }
  }

  return (
    <>
      <Card className={compact ? "border-0 shadow-none" : undefined}>
        <CardHeader
          className={cn(
            "flex flex-row flex-wrap items-center justify-between gap-3 space-y-0",
            compact && "px-0 pt-0",
          )}
        >
          <div className="min-w-0 flex-1">
            <CardTitle>{compact ? "Simulación del torneo" : "Categorías"}</CardTitle>
            <CardDescription>
              {compact
                ? "Estimá partidos y tiempos con N confirmadas por categoría."
                : "Cada categoría compite con parejas y fixture propios. Activá Simulación para estimar el torneo completo con N confirmadas por categoría."}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {categories.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                <Checkbox
                  checked={simulationEnabled}
                  disabled={readOnly}
                  onCheckedChange={(v) => setSimulationEnabled(v === true)}
                  aria-label="Simulación integral del torneo"
                />
                <span>Simulación</span>
              </label>
            )}
            {simulationEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportSimulation}
                disabled={simulationRows.length === 0}
              >
                <FileDown className="size-4" />
                PDF
              </Button>
            )}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Agregar categoría
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className={compact ? "px-0" : undefined}>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin categorías todavía. Agregá al menos una del catálogo del club
              para configurar el torneo e inscribir parejas.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {rows.map(({ category, sim, color, result }) => (
                  <div
                    key={category.id}
                    className={cn(
                      "rounded-lg border p-3",
                      simulationEnabled &&
                        "border-amber-300/80 bg-amber-50/30 dark:bg-amber-950/10",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <p className="min-w-0 truncate font-medium">
                        {category.name}
                      </p>
                      {category.abbreviation ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                          {category.abbreviation}
                        </span>
                      ) : null}
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeCategory(category)}
                          title="Quitar del torneo"
                          aria-label={`Quitar ${category.name} del torneo`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                      {showInscriptionStats ? (
                        <>
                          <CategoryStat
                            label="Inscriptos"
                            value={category.pairCount}
                          />
                          <CategoryStat
                            label="Confirmadas"
                            value={category.confirmedCount}
                            editable={simulationEnabled && !readOnly}
                            editValue={sim.confirmed}
                            onEditChange={(value) =>
                              setConfirmed(category, value)
                            }
                          />
                          <CategoryStat
                            label="Sin compañero"
                            value={category.withoutPartnerCount}
                          />
                          <CategoryStat
                            label="Sin zona"
                            value={category.withoutZoneCount}
                          />
                        </>
                      ) : (
                        <CategoryStat
                          label="Confirmadas (simulación)"
                          value={category.confirmedCount}
                          editable={simulationEnabled && !readOnly}
                          editValue={sim.confirmed}
                          onEditChange={(value) => setConfirmed(category, value)}
                        />
                      )}
                      {simulationEnabled && result ? (
                        <CategorySimulationStats result={result} />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {simulationEnabled && (
                <IntegralSimulation
                  rows={simulationRows}
                  playDays={playDays}
                  courtCount={courtCount}
                  unconfiguredNames={unconfiguredNames}
                  slotMinutes={slotMinutes}
                  readOnly={readOnly}
                  onAdjustPlayDay={adjustPlayDay}
                  onSetPlayDayStartMinutes={setStartMinutes}
                  canAdjustPlayDay={(playDate, edge, delta) =>
                    canShiftPlayDayVisibleWindow(
                      playDays.find((day) => day.date === playDate),
                      slotMinutesForDate(playDate),
                      edge,
                      delta,
                    )
                  }
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddCategoryDialog
        clubSlug={clubSlug}
        tournamentId={tournamentId}
        catalogCategories={catalogCategories}
        tournamentCategories={categories}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => router.refresh()}
      />
    </>
  );
}

function CategoryStat({
  label,
  value,
  editable,
  editValue,
  onEditChange,
}: {
  label: string;
  value: number;
  editable?: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {editable ? (
        <Input
          type="number"
          min={0}
          max={256}
          inputMode="numeric"
          className="mt-1 h-8 w-full max-w-[5.5rem] px-2 text-lg font-semibold tabular-nums"
          value={editValue ?? ""}
          onChange={(e) => onEditChange?.(e.target.value)}
          aria-label={`${label} (simulación)`}
        />
      ) : (
        <p className="mt-1 text-lg font-semibold leading-none tabular-nums">
          {value}
        </p>
      )}
    </div>
  );
}

function CategorySimulationStats({
  result,
}: {
  result: CategoryScheduleSimulation;
}) {
  const breakdown = breakdownCategorySimulation(result);
  return (
    <>
      <CategoryStat label="Partidos totales" value={breakdown.totalMatches} />
      <CategoryStat label="Zonas de 3" value={breakdown.zonesOf3} />
      <CategoryStat label="Zonas de 4" value={breakdown.zonesOf4} />
      {breakdown.zonesOf2 > 0 ? (
        <CategoryStat label="Zonas de 2" value={breakdown.zonesOf2} />
      ) : null}
      <CategoryStat label="Partidos zona" value={breakdown.zoneMatches} />
      {breakdown.knockoutRounds.map((round) => (
        <CategoryStat
          key={round.key}
          label={round.label}
          value={round.matches}
        />
      ))}
    </>
  );
}

/// Simulación integral: un solo conjunto de días y canchas para todas las
/// categorías, con los partidos intercalados entre ellas.
function IntegralSimulation({
  rows,
  playDays,
  courtCount,
  unconfiguredNames,
  slotMinutes: sharedSlotMinutes,
  readOnly = false,
  onAdjustPlayDay,
  onSetPlayDayStartMinutes,
  canAdjustPlayDay,
}: {
  rows: SimulationRow[];
  playDays: PlayDayValues[];
  courtCount: number;
  unconfiguredNames: string[];
  slotMinutes?: number;
  readOnly?: boolean;
  onAdjustPlayDay?: (
    playDate: string,
    edge: PlayDayWindowEdge,
    delta: PlayDayWindowDelta,
  ) => void;
  onSetPlayDayStartMinutes?: (
    playDate: string,
    minutes: PlayDayStartMinutes,
  ) => void;
  canAdjustPlayDay?: (
    playDate: string,
    edge: PlayDayWindowEdge,
    delta: PlayDayWindowDelta,
  ) => boolean;
}) {
  const [view, setView] = useState<"lista" | "regla">("regla");

  if (playDays.length === 0) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Configurá días, horarios y formatos del torneo para poder simular.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingresá una cantidad de parejas confirmadas para simular.
      </p>
    );
  }

  const slotMinutes =
    sharedSlotMinutes ??
    Math.max(
      ...rows.map((row) => phaseSlotMinutes(row.categoryConfig, "zones")),
    );

  const categoryLoads: SimulationCategoryLoad[] = rows.map((row) => ({
    categoryId: row.category.id,
    zonesPlayDates: row.categoryConfig.phases.zones.playDates,
    knockoutPlayDates: row.categoryConfig.phases.knockout.playDates,
    finalPlayDates: row.categoryConfig.phases.final.playDates,
    zoneMatches: row.result.zoneMatches,
    intermediateMatches: row.result.intermediateMatches,
    finalMatches: row.result.finalMatches,
    zonesSlotMinutes: phaseSlotMinutes(row.categoryConfig, "zones"),
    knockoutSlotMinutes: phaseSlotMinutes(row.categoryConfig, "knockout"),
    finalSlotMinutes: phaseSlotMinutes(row.categoryConfig, "final"),
  }));

  const ruleGrid = buildSimulationRuleGrid({
    playDays,
    courtCount,
    zonesSlotMinutes: slotMinutes,
    categoryLoads,
  });

  const summary = summarizeIntegralSimulation(
    ruleGrid,
    rows.map((row) => ({
      categoryId: row.category.id,
      result: row.result,
      zonesPlayDates: row.categoryConfig.phases.zones.playDates,
      knockoutPlayDates: row.categoryConfig.phases.knockout.playDates,
      finalPlayDates: row.categoryConfig.phases.final.playDates,
    })),
    slotMinutes,
  );

  const gridCategories: SlotRuleGridCategory[] = rows.map((row) => ({
    id: row.category.id,
    name: row.category.name,
    abbreviation: row.category.abbreviation,
    color: row.color,
  }));

  const packedByCategory = new Map(
    summary.categories.map((c) => [c.categoryId, c]),
  );

  return (
    <div className="space-y-3 rounded-md border border-dashed bg-background/80 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Simulación integral</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "rounded px-2 py-0.5",
                view === "lista" && "bg-muted font-medium",
              )}
              onClick={() => setView("lista")}
            >
              Lista
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2 py-0.5",
                view === "regla" && "bg-muted font-medium",
              )}
              onClick={() => setView("regla")}
            >
              Regla
            </button>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              summary.fits
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
            )}
          >
            {summary.fits ? "El tiempo alcanza" : "No alcanza el tiempo"}
          </span>
        </div>
      </div>

      <p className="text-muted-foreground">
        {rows.length} categoría{rows.length === 1 ? "" : "s"}
        {" · "}
        {summary.matchCount} partidos · {courtCount} cancha
        {courtCount === 1 ? "" : "s"} · {playDays.length} día
        {playDays.length === 1 ? "" : "s"} de juego · el tamaño del slot sigue la fase de cada día
        {" · "}
        {summary.usedCells}/{summary.totalCells} slots ocupados
      </p>

      {unconfiguredNames.length > 0 && (
        <p className="text-amber-700 dark:text-amber-400">
          Sin configuración (no entran en la simulación):{" "}
          {unconfiguredNames.join(", ")}.
        </p>
      )}

      {view === "regla" ? (
        <SlotRuleGrid
          mode="simulation"
          rules={ruleGrid}
          categories={gridCategories}
          onAdjustPlayDay={onAdjustPlayDay}
          onSetPlayDayStartMinutes={onSetPlayDayStartMinutes}
          canAdjustPlayDay={canAdjustPlayDay}
          adjustDisabled={readOnly}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Fase</th>
                  <th className="py-1.5 pr-3 font-medium">Partidos</th>
                  <th className="py-1.5 pr-3 font-medium">Días</th>
                  <th className="py-1.5 pr-3 font-medium">Necesario</th>
                  <th className="py-1.5 pr-3 font-medium">Disponible</th>
                  <th className="py-1.5 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {summary.phases.map((phase) => (
                  <tr
                    key={phase.key}
                    className="border-b border-dashed last:border-0"
                  >
                    <td className="py-2 pr-3 font-medium">{phase.label}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {phase.packedCount < phase.matchCount
                        ? `${phase.packedCount}/${phase.matchCount}`
                        : phase.matchCount}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {phase.missingPlayDates ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          Sin asignar
                        </span>
                      ) : (
                        phase.dayCount
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatSimulationDuration(phase.minutesNeeded)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatSimulationDuration(phase.minutesAvailable)}
                    </td>
                    <td
                      className={cn(
                        "py-2 tabular-nums font-medium",
                        phase.matchCount === 0
                          ? "text-muted-foreground"
                          : phase.fits
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400",
                      )}
                    >
                      {phase.matchCount === 0
                        ? "—"
                        : phase.missingPlayDates
                          ? "Sin días"
                          : `${phase.surplusMinutes >= 0 ? "Sobra" : "Falta"} ${formatSimulationDuration(Math.abs(phase.surplusMinutes))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Categoría</th>
                  <th className="py-1.5 pr-3 font-medium">Confirmadas</th>
                  <th className="py-1.5 pr-3 font-medium">Zonas</th>
                  <th className="py-1.5 pr-3 font-medium">Avanzan</th>
                  <th className="py-1.5 font-medium">Partidos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const packed = packedByCategory.get(row.category.id);
                  const missing =
                    packed != null && packed.packedCount < packed.matchCount;
                  return (
                    <tr
                      key={row.category.id}
                      className="border-b border-dashed last:border-0"
                    >
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="font-medium">
                            {row.category.name}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.result.confirmedPairs}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.result.zoneCount}
                        {row.result.zoneSizes.length > 0
                          ? ` (${row.result.zoneSizes.join(" + ")})`
                          : ""}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.result.advancers}
                        {row.result.bracketSize > 0
                          ? ` · cuadro de ${row.result.bracketSize}`
                          : ""}
                      </td>
                      <td
                        className={cn(
                          "py-2 tabular-nums",
                          missing && "text-rose-700 dark:text-rose-400",
                        )}
                      >
                        {missing
                          ? `${packed?.packedCount}/${packed?.matchCount}`
                          : row.result.totalMatches}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat
              label="Total necesario"
              value={formatSimulationDuration(summary.minutesNeeded)}
            />
            <MiniStat
              label="Total disponible"
              value={formatSimulationDuration(summary.minutesAvailable)}
            />
            <MiniStat
              label={
                summary.surplusMinutes >= 0
                  ? "Sobra (según regla)"
                  : "Falta (según regla)"
              }
              value={formatSimulationDuration(Math.abs(summary.surplusMinutes))}
            />
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {view === "regla"
          ? `Un solo conjunto de días con ${courtCount} regla${courtCount === 1 ? "" : "s"} por día (una por cancha). Los + / − alargan o recortan el mismo rango que en Parámetros. Clic derecho en el primer slot para elegir minutos de arranque (0 / 15 / 30 / 45). Los partidos se intercalan entre categorías: zonas → intermedia → final. El punto de color indica qué categoría ocupa cada slot.`
          : "Disponible y balance salen de la misma grilla de slots que el modo Regla (celdas libres tras empaquetar todas las categorías)."}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
