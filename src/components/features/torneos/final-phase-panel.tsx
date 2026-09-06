"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

import { buildFinalFixtureAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
import { formatWeekday } from "@/lib/date";
import { FINAL_PHASE_START_ROUND_LABELS } from "@/modules/tournaments/domain/config-schema";
import {
  buildFinalOfficialRounds,
  eligiblePairCount,
  finalPhaseSettings,
} from "@/modules/tournaments/domain/intermediate-phase";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { IntermediateRoundCard } from "./intermediate-round-card";
import { ActualizarConfirmButton } from "./actualizar-confirm-button";
import { FixtureEditModeSelect } from "./fixture-edit-mode-select";
import {
  buildFinalMatchGridRows,
  toGrillaPdfRows,
} from "./final-match-grid-model";
import { useFixtureEditMode } from "./fixture-edit-mode-context";
import { buildActualizarConfirmCopy } from "@/modules/tournaments/domain/fixture-edit-mode";
import { GrillaPdfMenu } from "./grilla-pdf-menu";
import { categoryKnockoutNameResolver } from "./knockout-name-resolver";
import { useKnockoutFixtureReorder } from "./use-knockout-fixture-reorder";
import { useTournamentReadOnly } from "./tournament-mode-context";

export function FinalPhasePanel({
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
  const [isPending, startTransition] = useTransition();
  const category = categories.find((item) => item.id === categoryId) ?? null;
  const fixture = config?.categories.find(
    (item) => item.categoryId === categoryId,
  )?.finalFixture;
  const settings = finalPhaseSettings(config, categoryId);
  const pairCount = eligiblePairCount(pairs, categoryId);
  const rounds = useMemo(
    () =>
      buildFinalOfficialRounds(
        pairCount,
        settings.zone4Advancers,
        settings.startsAtRound,
      ),
    [pairCount, settings.startsAtRound, settings.zone4Advancers],
  );

  const dayOptions = useMemo(() => {
    const playDays = config?.playDays ?? [];
    const finalDates =
      config?.categories.find((item) => item.categoryId === categoryId)?.phases
        .final.playDates ?? [];
    const dates = new Set(finalDates.filter(Boolean));
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

  const {
    scheduleByOfficialId,
    scoresByOfficialId,
    canReorder,
    orderedCrossings,
    moveCrossing,
    updateScore,
    flushPersist,
  } = useKnockoutFixtureReorder({
      clubSlug,
      tournamentId,
      categoryId,
      phase: "final",
      fixture,
      dayOpenByDate,
      officialRounds: rounds,
    });

  const matchCount = rounds.reduce(
    (sum, round) => sum + round.crossings.length,
    0,
  );
  const regulation = settings.zone4Advancers === 2 ? "APA" : "FAP";
  const startsAtLabel = FINAL_PHASE_START_ROUND_LABELS[settings.startsAtRound];
  const readOnly = useTournamentReadOnly();
  const { isManual, modes } = useFixtureEditMode(categoryId, "final");
  const hasFixture = Boolean(fixture?.rounds.length);
  const resolveLabel = useMemo(
    () =>
      categoryKnockoutNameResolver({
        config,
        categoryId,
        pairs,
        matchFormat: settings.matchFormat,
      }),
    [categoryId, config, pairs, settings.matchFormat],
  );
  const pdfRows = useMemo(() => {
    if (!category) return [];
    return toGrillaPdfRows(
      buildFinalMatchGridRows({
        categories: [category],
        pairs,
        config,
      }),
    );
  }, [category, config, pairs]);

  function handleActualizar() {
    startTransition(async () => {
      await flushPersist();
      const result = await buildFinalFixtureAction(
        clubSlug,
        tournamentId,
        categoryId,
      );
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

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4 text-muted-foreground" />
          Fase Final{category ? ` · ${category.name}` : ""}
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
                phase="final"
              />
              <ActualizarConfirmButton
                pending={isPending}
                disabled={isManual}
                heading={
                  isManual
                    ? "Actualizar está bloqueada en Modo Manual"
                    : hasFixture
                      ? "Vuelve a armar la final de esta categoría"
                      : "Arma la final de esta categoría"
                }
                effects={
                  isManual
                    ? [
                        "En Manual no se regeneran los cruces",
                        "Podés cambiar el orden de los partidos con las flechas",
                      ]
                    : buildActualizarConfirmCopy({
                        phase: "final",
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
                      ? "Pisa los ajustes de esta categoría. No toca zonas ni intermedia."
                      : "Programa los cruces de esta categoría en el último día."
                }
                confirm={buildActualizarConfirmCopy({
                  phase: "final",
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
            title="Ayuda de fase final"
            description="Cómo se arma y se edita la llave final."
          >
            <p>
              Llave oficial {regulation}. Desde {startsAtLabel} hasta la Final.
              Los cruces usan los puestos de zona y los ganadores de la fase
              intermedia.
            </p>
            <p>
              <span className="font-medium text-foreground">Actualizar</span>{" "}
              asigna día, horario y cancha en el último día del torneo. En Modo
              Manual podés cambiar el orden de los partidos. Los resultados se
              guardan solos.
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
            Esta categoría no tiene rondas de fase final.
          </p>
        ) : (
          rounds.map((round) => (
            <IntermediateRoundCard
              key={round.label}
              label={round.label}
              crossings={orderedCrossings(round.crossings)}
              matchFormat={settings.matchFormat}
              courtCount={config?.courtCount || courtCount}
              dayOptions={dayOptions}
              showOfficialId={settings.zone4Advancers === 3}
              scheduleByOfficialId={scheduleByOfficialId}
              scoresByOfficialId={scoresByOfficialId}
              onScoreChange={updateScore}
              scoresReadOnly={readOnly}
              resolveLabel={resolveLabel}
              canReorder={canReorder}
              onMove={(officialId, direction) =>
                moveCrossing(round.crossings, officialId, direction)
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
