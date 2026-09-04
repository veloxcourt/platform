"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";

import { buildFinalFixtureAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const scheduleByOfficialId = useMemo(() => {
    const map = new Map<
      number,
      {
        playDate: string | null;
        startTime: string | null;
        courtIndex: number | null;
        noRestGap?: boolean;
      }
    >();
    for (const round of fixture?.rounds ?? []) {
      for (const match of round.matches) {
        map.set(match.officialId, {
          playDate: match.playDate,
          startTime: match.startTime,
          courtIndex: match.courtIndex,
          noRestGap: match.noRestGap,
        });
      }
    }
    return map;
  }, [fixture]);

  const matchCount = rounds.reduce(
    (sum, round) => sum + round.crossings.length,
    0,
  );
  const regulation = settings.zone4Advancers === 2 ? "APA" : "FAP";
  const startsAtLabel = FINAL_PHASE_START_ROUND_LABELS[settings.startsAtRound];
  const readOnly = useTournamentReadOnly();
  const hasFixture = Boolean(fixture?.rounds.length);

  function handleActualizar() {
    startTransition(async () => {
      const result = await buildFinalFixtureAction(clubSlug, tournamentId);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4 text-muted-foreground" />
          Fase Final{category ? ` · ${category.name}` : ""}
        </CardTitle>
        <CardDescription>
          Llave oficial {regulation}. Desde {startsAtLabel} hasta la Final. Los
          cruces usan los puestos de zona y los ganadores de la fase intermedia.{" "}
          <span className="font-medium text-foreground">Actualizar</span>{" "}
          asigna día, horario y cancha en el último día del torneo.
          {!hasFixture ? " Todavía no hay un armado guardado." : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {pairCount} pareja{pairCount === 1 ? "" : "s"} con compañero ·{" "}
            {rounds.length} ronda{rounds.length === 1 ? "" : "s"} · {matchCount}{" "}
            partido{matchCount === 1 ? "" : "s"}.
          </p>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              onClick={handleActualizar}
              disabled={isPending}
            >
              <RefreshCw
                className={`size-4 ${isPending ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          )}
        </div>
        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta categoría no tiene rondas de fase final.
          </p>
        ) : (
          rounds.map((round) => (
            <IntermediateRoundCard
              key={round.label}
              label={round.label}
              crossings={round.crossings}
              matchFormat={settings.matchFormat}
              courtCount={config?.courtCount || courtCount}
              dayOptions={dayOptions}
              showOfficialId={settings.zone4Advancers === 3}
              scheduleByOfficialId={scheduleByOfficialId}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
