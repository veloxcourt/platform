"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import type {
  CategoryPhaseConfig,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import type { PlayDayValues } from "@/modules/tournaments/domain/config-schema";
import {
  applySharedCourtCapacity,
  availableCourtMinutes,
  formatSimulationDuration,
  playDaysForDates,
  simulateCategorySchedule,
  type CategoryScheduleSimulation,
} from "@/modules/tournaments/domain/simulate-category-schedule";
import {
  applyPackedSlotsToSimulation,
  buildSimulationRuleGrid,
} from "@/modules/tournaments/domain/court-day-slots";
import type { SimulationCategoryLoad } from "@/modules/tournaments/domain/court-day-slots";
import { SlotRuleGrid } from "./slot-rule-grid";
import { updateCategorySimulationAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/categorias/actions";
import { AddCategoryDialog } from "./add-category-dialog";

type SimulationDraft = {
  enabled: boolean;
  confirmed: string;
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

export function TournamentCategoriesPanel({
  clubSlug,
  tournamentId,
  categories,
  levels,
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
  levels: string[];
  config: TournamentConfig | null;
  courtCount: number;
  showInscriptionStats?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, SimulationDraft>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, draftFromCategory(c)])),
  );
  const [, startTransition] = useTransition();
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  function persist(
    category: TournamentCategoryItem,
    draft: SimulationDraft,
    options?: { debounceMs?: number },
  ) {
    const debounceMs = options?.debounceMs ?? 0;
    const existingTimer = saveTimers.current[category.id];
    if (existingTimer) clearTimeout(existingTimer);

    const run = () => {
      const parsed = Number.parseInt(draft.confirmed, 10);
      const simulationConfirmedCount =
        draft.confirmed.trim() === "" || !Number.isFinite(parsed)
          ? null
          : Math.min(256, Math.max(0, parsed));

      startTransition(async () => {
        const result = await updateCategorySimulationAction(
          clubSlug,
          tournamentId,
          category.id,
          {
            simulationEnabled: draft.enabled,
            simulationConfirmedCount,
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

  function setEnabled(category: TournamentCategoryItem, enabled: boolean) {
    const current = simulationState(category);
    const next = {
      enabled,
      confirmed: current.confirmed || defaultConfirmed(category),
    };
    setDrafts((prev) => ({ ...prev, [category.id]: next }));
    persist(category, next);
  }

  function setConfirmed(category: TournamentCategoryItem, confirmed: string) {
    const current = simulationState(category);
    const next = { enabled: current.enabled, confirmed };
    setDrafts((prev) => ({ ...prev, [category.id]: next }));
    persist(category, next, { debounceMs: 500 });
  }

  return (
    <>
      <Card className={compact ? "border-0 shadow-none" : undefined}>
        <CardHeader
          className={cn(
            "flex-row items-center justify-between gap-3 space-y-0",
            compact && "px-0 pt-0",
          )}
        >
          <div>
            <CardTitle>{compact ? "Simulación por categoría" : "Categorías"}</CardTitle>
            <CardDescription>
              {compact
                ? "Estimá partidos y tiempos con N confirmadas. Las inscripciones reales se ven en Inscripciones."
                : "Cada categoría compite con parejas y fixture propios. Activá Simulación para estimar partidos y tiempos con N confirmadas."}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Agregar categoría
          </Button>
        </CardHeader>
        <CardContent className={compact ? "px-0" : undefined}>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin categorías todavía. Creá al menos una para configurar el torneo
              e inscribir parejas.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {(() => {
                const rawSims = categories.map((category) => {
                  const sim = simulationState(category);
                  const categoryConfig = config?.categories.find(
                    (c) => c.categoryId === category.id,
                  );
                  const simulatedCount = Number.parseInt(sim.confirmed, 10);
                  const raw =
                    sim.enabled &&
                    categoryConfig &&
                    config &&
                    Number.isFinite(simulatedCount) &&
                    simulatedCount >= 0
                      ? simulateCategorySchedule(
                          simulatedCount,
                          categoryConfig,
                          config.playDays,
                          courtCount,
                        )
                      : null;
                  return { category, sim, categoryConfig, raw };
                });

                const sharedZonesDates = [
                  ...new Set(
                    rawSims.flatMap((row) =>
                      row.raw && row.categoryConfig
                        ? row.categoryConfig.phases.zones.playDates
                        : [],
                    ),
                  ),
                ];
                const sharedZonesAvailable =
                  config && sharedZonesDates.length > 0
                    ? availableCourtMinutes(
                        playDaysForDates(config.playDays, sharedZonesDates),
                        courtCount,
                      )
                    : 0;

                const totalZonesNeeded = rawSims.reduce((sum, row) => {
                  const zones = row.raw?.phases.find((p) => p.key === "zones");
                  return sum + (zones?.minutesNeeded ?? 0);
                }, 0);
                const totalZonesMatches = rawSims.reduce(
                  (sum, row) => sum + (row.raw?.zoneMatches ?? 0),
                  0,
                );

                const simRows = rawSims.filter(
                  (row): row is typeof row & {
                    raw: CategoryScheduleSimulation;
                    categoryConfig: CategoryPhaseConfig;
                  } => Boolean(row.raw && row.categoryConfig),
                );

                const sharedResults =
                  simRows.length > 1 && config
                    ? applySharedCourtCapacity(
                        simRows.map((row) => ({
                          result: row.raw,
                          zonesPlayDates:
                            row.categoryConfig.phases.zones.playDates,
                          knockoutPlayDates:
                            row.categoryConfig.phases.knockout.playDates,
                          finalPlayDates:
                            row.categoryConfig.phases.final.playDates,
                        })),
                        config.playDays,
                        courtCount,
                      )
                    : null;

                const resultByCategoryId = new Map(
                  simRows.map((row, index) => [
                    row.category.id,
                    sharedResults?.[index] ?? row.raw,
                  ]),
                );

                const categoryLoads: SimulationCategoryLoad[] = simRows.map(
                  (row) => ({
                    categoryId: row.category.id,
                    zonesPlayDates:
                      row.categoryConfig.phases.zones.playDates,
                    knockoutPlayDates:
                      row.categoryConfig.phases.knockout.playDates,
                    finalPlayDates:
                      row.categoryConfig.phases.final.playDates,
                    zoneMatches: row.raw.zoneMatches,
                    intermediateMatches: row.raw.intermediateMatches,
                    finalMatches: row.raw.finalMatches,
                  }),
                );

                return (
                  <>
                    {simRows.length > 1 && (
                      <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm">
                        <p className="font-medium">
                          Capacidad compartida ({courtCount} cancha
                          {courtCount === 1 ? "" : "s"} · mismas para todas las
                          categorías)
                        </p>
                        <p className="text-muted-foreground">
                          Zonas: {totalZonesMatches} partidos · necesario{" "}
                          {formatSimulationDuration(totalZonesNeeded)} ·
                          disponible en días de zonas{" "}
                          {formatSimulationDuration(sharedZonesAvailable)}
                          {totalZonesNeeded > sharedZonesAvailable
                            ? " · no alcanza entre todas"
                            : " · alcanza entre todas"}
                          . A la misma hora solo hay {courtCount} partido
                          {courtCount === 1 ? "" : "s"} en paralelo. En la
                          regla los partidos se intercalan entre categorías.
                        </p>
                      </div>
                    )}

                    {rawSims.map(({ category, sim, categoryConfig, raw }) => {
                        const result =
                          resultByCategoryId.get(category.id) ?? raw;

                        return (
                          <div
                            key={category.id}
                            className={cn(
                              "rounded-lg border p-3",
                              sim.enabled &&
                                "border-amber-300/80 bg-amber-50/30 dark:bg-amber-950/10",
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">{category.name}</p>
                              <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                  checked={sim.enabled}
                                  onCheckedChange={(v) =>
                                    setEnabled(category, v === true)
                                  }
                                  aria-label={`Simulación ${category.name}`}
                                />
                                <span>Simulación</span>
                              </label>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {showInscriptionStats ? (
                                <>
                                  <CategoryStat
                                    label="Inscriptos"
                                    value={category.pairCount}
                                  />
                                  <CategoryStat
                                    label="Confirmadas"
                                    value={category.confirmedCount}
                                    editable={sim.enabled}
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
                                  editable={sim.enabled}
                                  editValue={sim.confirmed}
                                  onEditChange={(value) =>
                                    setConfirmed(category, value)
                                  }
                                />
                              )}
                            </div>

                            {sim.enabled && (
                              <SimulationResult
                                hasConfig={Boolean(
                                  categoryConfig && config?.playDays.length,
                                )}
                                result={result}
                                categoryConfig={categoryConfig ?? null}
                                playDays={config?.playDays ?? []}
                                courtCount={courtCount}
                                categoryLoads={categoryLoads}
                                currentCategoryId={category.id}
                                sharedCourtsNote={simRows.length > 1}
                              />
                            )}
                          </div>
                        );
                      },
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <AddCategoryDialog
        clubSlug={clubSlug}
        tournamentId={tournamentId}
        levels={levels}
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
        <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
      )}
    </div>
  );
}

function SimulationResult({
  hasConfig,
  result,
  categoryConfig,
  playDays,
  courtCount,
  categoryLoads = [],
  currentCategoryId,
  sharedCourtsNote = false,
}: {
  hasConfig: boolean;
  result: CategoryScheduleSimulation | null;
  categoryConfig: CategoryPhaseConfig | null;
  playDays: PlayDayValues[];
  courtCount: number;
  categoryLoads?: SimulationCategoryLoad[];
  currentCategoryId: string;
  sharedCourtsNote?: boolean;
}) {
  const [view, setView] = useState<"lista" | "regla">("lista");

  if (!hasConfig) {
    return (
      <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
        Configurá días, horarios y formatos del torneo para poder simular.
      </p>
    );
  }

  if (!result) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Ingresá una cantidad de parejas confirmadas para simular.
      </p>
    );
  }

  const zonesSlotMinutes =
    (categoryConfig?.phases.zones.matchDurationMin ?? 75) +
    (categoryConfig?.intervalMin ?? 0);

  const loadsForGrid =
    categoryLoads.length > 0
      ? categoryLoads
      : categoryConfig
        ? [
            {
              categoryId: currentCategoryId,
              zonesPlayDates: categoryConfig.phases.zones.playDates,
              knockoutPlayDates: categoryConfig.phases.knockout.playDates,
              finalPlayDates: categoryConfig.phases.final.playDates,
              zoneMatches: result.zoneMatches,
              intermediateMatches: result.intermediateMatches,
              finalMatches: result.finalMatches,
            },
          ]
        : [];

  const ruleGrid = categoryConfig
    ? buildSimulationRuleGrid({
        playDays,
        courtCount,
        zonesSlotMinutes,
        categoryLoads: loadsForGrid,
        currentCategoryId,
      })
    : [];

  const displayResult =
    categoryConfig && ruleGrid.length > 0
      ? applyPackedSlotsToSimulation(
          result,
          ruleGrid,
          {
            zones: categoryConfig.phases.zones.playDates,
            knockout: categoryConfig.phases.knockout.playDates,
            final: categoryConfig.phases.final.playDates,
          },
          zonesSlotMinutes,
        )
      : result;

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed bg-background/80 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Resultado de la simulación</p>
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
              displayResult.fits
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
            )}
          >
            {displayResult.fits ? "El tiempo alcanza" : "No alcanza el tiempo"}
          </span>
        </div>
      </div>

      <p className="text-muted-foreground">
        {displayResult.zoneCount} zonas
        {displayResult.zoneSizes.length > 0
          ? ` (${displayResult.zoneSizes.join(" + ")})`
          : ""}
        {" · "}
        objetivo {categoryConfig?.pairsPerZone ?? 3}/zona
        {" · "}
        {displayResult.advancers} avanzan a llave
        {displayResult.bracketSize > 0
          ? ` (cuadro de ${displayResult.bracketSize})`
          : ""}
        {" · "}
        {displayResult.courtCount} cancha
        {displayResult.courtCount === 1 ? "" : "s"} ·{" "}
        {playDays.length} día{playDays.length === 1 ? "" : "s"} de juego
      </p>

      {view === "regla" ? (
        <SlotRuleGrid mode="simulation" rules={ruleGrid} />
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
                {displayResult.phases.map((phase) => (
                  <tr
                    key={phase.key}
                    className="border-b border-dashed last:border-0"
                  >
                    <td className="py-2 pr-3 font-medium">{phase.label}</td>
                    <td className="py-2 pr-3 tabular-nums">{phase.matchCount}</td>
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

          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat
              label="Total necesario"
              value={formatSimulationDuration(displayResult.minutesNeeded)}
            />
            <MiniStat
              label="Total disponible"
              value={formatSimulationDuration(displayResult.minutesAvailable)}
            />
            <MiniStat
              label={
                displayResult.surplusMinutes >= 0
                  ? "Sobra (según regla)"
                  : "Falta (según regla)"
              }
              value={formatSimulationDuration(
                Math.abs(displayResult.surplusMinutes),
              )}
            />
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {view === "regla"
          ? sharedCourtsNote
            ? `Modo regla: zonas → intermedia → final (sin solapar en el tiempo). Canchas en paralelo e intercalado entre categorías. ${courtCount} cancha${courtCount === 1 ? "" : "s"} → ${courtCount} partido${courtCount === 1 ? "" : "s"} a la misma hora.`
            : "Modo regla: primero zonas (todas las canchas en paralelo); intermedia y final recién después del último partido de la fase anterior."
          : "Disponible y balance salen de la misma grilla de slots que el modo Regla (celdas libres tras empaquetar)."}
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
