"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, GitBranch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { ActualizarHoverHint } from "./actualizar-hover-hint";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
import { formatWeekday } from "@/lib/date";
import {
  buildIntermediateFixtureAction,
  calculateZoneQualificationAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import {
  buildIntermediateOfficialRounds,
  eligiblePairCount,
  intermediatePhaseSettings,
} from "@/modules/tournaments/domain/intermediate-phase";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { ChangeZoneTimeDialog } from "./change-zone-time-dialog";
import { IntermediateRoundCard } from "./intermediate-round-card";
import { buildKnockoutSlotRules } from "./knockout-match-rule-model";
import { useAdjustablePlayDays } from "./use-adjustable-play-days";
import { ActualizarConfirmButton } from "./actualizar-confirm-button";
import { FixtureEditModeSelect } from "./fixture-edit-mode-select";
import { useFixtureEditMode } from "./fixture-edit-mode-context";
import { buildActualizarConfirmCopy } from "@/modules/tournaments/domain/fixture-edit-mode";
import { GrillaPdfMenu } from "./grilla-pdf-menu";
import {
  buildIntermediateMatchGridRows,
  toGrillaPdfRows,
} from "./intermediate-match-grid-model";
import { categoryKnockoutNameResolver } from "./knockout-name-resolver";
import { useKnockoutFixtureReorder } from "./use-knockout-fixture-reorder";
import { useTournamentReadOnly } from "./tournament-mode-context";
import { zoneRuleGridCategories } from "./zones-match-rule-model";

export function IntermediatePhasePanel({
  clubSlug,
  tournamentId,
  categories,
  pairs,
  config,
  courtCount,
  categoryId,
}: {
  clubSlug: string;
  tournamentId: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  courtCount: number;
  categoryId: string;
}) {
  const router = useRouter();
  const readOnly = useTournamentReadOnly();
  const { isManual, modes } = useFixtureEditMode(categoryId, "intermediate");
  const [isPending, startTransition] = useTransition();
  const [isCalculating, startCalculate] = useTransition();
  const category = categories.find((item) => item.id === categoryId) ?? null;
  const settings = intermediatePhaseSettings(config, categoryId);
  const pairCount = eligiblePairCount(pairs, categoryId);
  const fixture = config?.categories.find(
    (item) => item.categoryId === categoryId,
  )?.intermediateFixture;
  const rounds = useMemo(
    () =>
      buildIntermediateOfficialRounds(
        pairCount,
        settings.zone4Advancers,
        settings.startsAtRound,
      ),
    [pairCount, settings.startsAtRound, settings.zone4Advancers],
  );

  const dayOptions = useMemo(() => {
    const playDays = config?.playDays ?? [];
    const knockoutDates =
      config?.categories.find((item) => item.categoryId === categoryId)?.phases
        .knockout.playDates ?? [];
    const dates = new Set(knockoutDates.filter(Boolean));
    for (const day of playDays) {
      if (day.date) dates.add(day.date);
    }
    return [...dates].map((date) => {
      const dayIndex = playDays.findIndex((day) => day.date === date);
      const dayNum = dayIndex >= 0 ? dayIndex + 1 : null;
      return {
        value: date,
        label: dayNum
          ? `D${dayNum} · ${formatWeekday(date)}`
          : formatWeekday(date),
      };
    });
  }, [categoryId, config]);

  const dayOpenByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const day of config?.playDays ?? []) {
      if (day.date) map[day.date] = day.startTime;
    }
    return map;
  }, [config?.playDays]);

  const [changeScheduleOfficialId, setChangeScheduleOfficialId] = useState<
    number | null
  >(null);
  const [hideZoneMatches, setHideZoneMatches] = useState(false);
  const {
    draft,
    scheduleByOfficialId,
    scoresByOfficialId,
    canReorder,
    canEditSchedule,
    orderedCrossings,
    sortCrossingsBySchedule,
    moveCrossing,
    updateScore,
    updateSchedule,
    flushPersist,
  } = useKnockoutFixtureReorder({
      clubSlug,
      tournamentId,
      categoryId,
      phase: "intermediate",
      fixture,
      dayOpenByDate,
      officialRounds: rounds,
    });

  const matchCount = rounds.reduce(
    (sum, round) => sum + round.crossings.length,
    0,
  );
  const regulation = settings.zone4Advancers === 2 ? "APA" : "FAP";
  const hasFixture = Boolean(fixture?.rounds.length);
  const resolveLabel = useMemo(
    () =>
      categoryKnockoutNameResolver({
        config,
        categoryId,
        pairs,
        matchFormat: settings.matchFormat,
        liveIntermediateFixture: draft,
      }),
    [categoryId, config, draft, pairs, settings.matchFormat],
  );
  const pdfRows = useMemo(() => {
    if (!category) return [];
    return toGrillaPdfRows(
      buildIntermediateMatchGridRows({
        categories: [category],
        pairs,
        config,
      }),
    );
  }, [category, config, pairs]);

  const changeScheduleCrossing =
    changeScheduleOfficialId == null
      ? null
      : rounds
          .flatMap((round) =>
            round.crossings.map((crossing) => ({
              roundLabel: round.label,
              crossing,
            })),
          )
          .find((item) => item.crossing.id === changeScheduleOfficialId) ??
        null;
  const selectedSchedule =
    changeScheduleOfficialId == null
      ? null
      : scheduleByOfficialId.get(changeScheduleOfficialId);
  const selectedScheduleSlot = selectedSchedule
    ? {
        playDate: selectedSchedule.playDate ?? "",
        startTime: selectedSchedule.startTime ?? "",
        courtIndex: selectedSchedule.courtIndex,
      }
    : null;
  const knockoutSlotMinutes = useMemo(() => {
    const categoryConfig = config?.categories.find(
      (item) => item.categoryId === categoryId,
    );
    return Math.max(
      1,
      (categoryConfig?.phases.knockout.matchDurationMin ?? 60) +
        (categoryConfig?.intervalMin ?? 0),
    );
  }, [categoryId, config]);
  const {
    playDays: livePlayDays,
    adjustPlayDay,
    canAdjustPlayDay,
    adjustPending,
  } = useAdjustablePlayDays({
    clubSlug,
    tournamentId,
    playDays: config?.playDays ?? [],
    slotMinutesForDate: () => knockoutSlotMinutes,
    readOnly,
  });
  const liveConfig = useMemo(
    () => (config ? { ...config, playDays: livePlayDays } : null),
    [config, livePlayDays],
  );
  const timePickerRules = useMemo(() => {
    if (!liveConfig) return [];
    return buildKnockoutSlotRules({
      phase: "intermediate",
      categories,
      config: liveConfig,
      courtCount: liveConfig.courtCount || courtCount,
      liveFixtureByCategory: { [categoryId]: draft },
      exclude:
        changeScheduleOfficialId == null
          ? null
          : { categoryId, officialId: changeScheduleOfficialId },
      includeZones: !hideZoneMatches,
    });
  }, [
    categories,
    categoryId,
    changeScheduleOfficialId,
    hideZoneMatches,
    liveConfig,
    courtCount,
    draft,
  ]);
  const timePickerCategories = useMemo(
    () => zoneRuleGridCategories(categories),
    [categories],
  );

  useEffect(() => {
    setChangeScheduleOfficialId(null);
  }, [categoryId]);

  function handleCalcular() {
    startCalculate(async () => {
      await flushPersist();
      const result = await calculateZoneQualificationAction(
        clubSlug,
        tournamentId,
        categoryId,
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
          category?.name ?? "Esta categoría",
          `${result.seedCount} puesto${result.seedCount === 1 ? "" : "s"} definido${result.seedCount === 1 ? "" : "s"}`,
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

  function handleActualizar() {
    startTransition(async () => {
      await flushPersist();
      const result = await buildIntermediateFixtureAction(
        clubSlug,
        tournamentId,
        categoryId,
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

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" />
          Fase Intermedia{category ? ` · ${category.name}` : ""}
        </CardTitle>
        <CardAction>
          <div className="flex flex-wrap items-center justify-end gap-2">
          {!readOnly && (
            <>
              <FixtureEditModeSelect
                clubSlug={clubSlug}
                tournamentId={tournamentId}
                categoryId={categoryId}
                categoryName={category?.name}
                phase="intermediate"
              />
              <ActualizarHoverHint
                heading={`Calcula quién clasifica en ${category?.name ?? "esta categoría"}`}
                effects={[
                  "Recalcula 1.ª, 2.ª y quién queda afuera con los resultados de estas zonas",
                  "Completa los nombres en la intermedia de esta categoría",
                  "No cambia día, horario ni cancha",
                  "No toca las otras categorías",
                ]}
                note="El Calcular de arriba recorre todas las categorías."
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={handleCalcular}
                  disabled={isCalculating}
                >
                  <Calculator
                    className={`size-4 ${isCalculating ? "animate-pulse" : ""}`}
                  />
                  Calcular
                </Button>
              </ActualizarHoverHint>
              <ActualizarConfirmButton
                pending={isPending}
                disabled={isManual}
                heading={
                  isManual
                    ? "Actualizar está bloqueada en Modo Manual"
                    : hasFixture
                      ? "Vuelve a armar la intermedia de esta categoría"
                      : "Arma la intermedia de esta categoría"
                }
                effects={
                  isManual
                    ? [
                        "En Manual no se regeneran los cruces",
                        "Tocá día, horario o cancha para elegir las tres cosas juntas en la regla de slots",
                        "Las flechas intercambian el horario con el partido de arriba o abajo, sin mover la fila",
                      ]
                    : buildActualizarConfirmCopy({
                        phase: "intermediate",
                        scope: "category",
                        modes,
                        categories: categories.map((item) => ({
                          id: item.id,
                          name: item.name,
                        })),
                        categoryId,
                      }).affects
                }
                note={
                  isManual
                    ? "Pasá a Modo Automático en esta categoría si querés volver a generar."
                    : hasFixture
                      ? "Pisa los ajustes de esta categoría. No toca las zonas."
                      : "Programa los cruces de esta categoría según las reglas de intermedia."
                }
                confirm={buildActualizarConfirmCopy({
                  phase: "intermediate",
                  scope: "category",
                  modes,
                  categories: categories.map((item) => ({
                    id: item.id,
                    name: item.name,
                  })),
                  categoryId,
                })}
                onConfirm={handleActualizar}
              />
            </>
          )}
          <GrillaPdfMenu
            tournamentName={config?.tournamentName ?? ""}
            rows={pdfRows}
            groupColumnLabel="Ronda"
          />
          <AyudaButton
            title="Ayuda de fase intermedia"
            description="Cómo se arma y se edita la llave intermedia."
          >
            <p>
              Llave oficial {regulation}. Los cruces usan los puestos de zona
              (1° A, 2° B).
            </p>
            <p>
              <span className="font-medium text-foreground">Calcular</span>{" "}
              trae los nombres de quienes clasificaron en las zonas de esta
              categoría. El de arriba hace lo mismo en todas.
            </p>
            <p>
              <span className="font-medium text-foreground">Actualizar</span>{" "}
              asigna día, horario y cancha según las reglas de intermedia. En
              Modo Manual tocá día, horario o cancha para elegir las tres
              cosas juntas en la regla de slots. El partido se queda en su
              fila: no se reordena por horario. Las flechas solo intercambian
              el horario con el de arriba o abajo. Los resultados se guardan
              solos.
              {!hasFixture ? " Todavía no hay un armado guardado." : null}
            </p>
          </AyudaButton>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          {pairCount} pareja{pairCount === 1 ? "" : "s"} con compañero ·{" "}
          {rounds.length} ronda{rounds.length === 1 ? "" : "s"} · {matchCount}{" "}
          partido{matchCount === 1 ? "" : "s"}.
        </p>
        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta categoría no tiene rondas de fase intermedia.
          </p>
        ) : (
          rounds.map((round) => (
            <IntermediateRoundCard
              key={round.label}
              label={round.label}
              crossings={orderedCrossings(round.crossings)}
              matchFormat={settings.matchFormat}
              dayOptions={dayOptions}
              showOfficialId={settings.zone4Advancers === 3}
              scheduleByOfficialId={scheduleByOfficialId}
              scoresByOfficialId={scoresByOfficialId}
              onScoreChange={updateScore}
              scoresReadOnly={readOnly}
              resolveLabel={resolveLabel}
              canReorder={canReorder}
              canPickSlot={canEditSchedule}
              onMove={(officialId, direction) =>
                moveCrossing(round.crossings, officialId, direction)
              }
              onSortBySchedule={
                canEditSchedule
                  ? () => sortCrossingsBySchedule(round.crossings)
                  : undefined
              }
              onPickSchedule={setChangeScheduleOfficialId}
            />
          ))
        )}
        <ChangeZoneTimeDialog
          open={Boolean(changeScheduleCrossing)}
          onOpenChange={(open) => {
            if (!open) setChangeScheduleOfficialId(null);
          }}
          zoneLabel={
            changeScheduleCrossing
              ? `${changeScheduleCrossing.roundLabel} · n° ${changeScheduleCrossing.crossing.id}`
              : "este partido"
          }
          description={
            changeScheduleCrossing
              ? `Partido de ${changeScheduleCrossing.roundLabel} · n° ${changeScheduleCrossing.crossing.id}. Tocá un slot: se cargan día, horario y cancha juntas. Verde es libre; naranja está ocupado.`
              : undefined
          }
          rules={timePickerRules}
          categories={timePickerCategories}
          onAdjustPlayDay={adjustPlayDay}
          canAdjustPlayDay={canAdjustPlayDay}
          adjustDisabled={readOnly || adjustPending}
          hideZoneMatches={hideZoneMatches}
          onHideZoneMatchesChange={setHideZoneMatches}
          selectedSlot={selectedScheduleSlot}
          onSelect={(slot) => {
            if (changeScheduleOfficialId == null) return;
            updateSchedule(changeScheduleOfficialId, slot);
            setChangeScheduleOfficialId(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
