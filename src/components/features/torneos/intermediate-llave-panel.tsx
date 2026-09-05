"use client";

import { useMemo } from "react";
import { Workflow } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CALENDAR_PALETTE } from "@/modules/herramientas/domain/calendario-torneos";
import {
  eligiblePairCount,
  intermediatePhaseSettings,
  officialLlaveTree,
} from "@/modules/tournaments/domain/intermediate-phase";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { LlavePdfMenu } from "./llave-pdf-menu";
import type { LlavePdfClub, LlavePdfDraw } from "./llave-pdf";
import { categoryKnockoutNameResolver } from "./knockout-name-resolver";
import {
  OfficialBracketDiagram,
  bracketScheduleFromFixture,
} from "./official-bracket-diagram";

export function IntermediateLlavePanel({
  tournamentName,
  categories,
  pairs,
  config,
  club,
}: {
  tournamentName: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  club?: LlavePdfClub;
}) {
  const draws = useMemo(
    () =>
      categories.map((category, index) => {
        const settings = intermediatePhaseSettings(config, category.id);
        const pairCount = eligiblePairCount(pairs, category.id);
        return {
          category,
          color:
            category.color ??
            CALENDAR_PALETTE[index % CALENDAR_PALETTE.length]!,
          pairCount,
          regulation: settings.zone4Advancers === 2 ? "APA" : "FAP",
          showOfficialId: settings.zone4Advancers === 3,
          startsAtRound: settings.startsAtRound,
          tree: officialLlaveTree(pairCount, settings.zone4Advancers),
          scheduleByOfficialId: bracketScheduleFromFixture(
            config?.categories.find((item) => item.categoryId === category.id)
              ?.intermediateFixture,
          ),
          resolveLabel: categoryKnockoutNameResolver({
            config,
            categoryId: category.id,
            pairs,
            matchFormat: settings.matchFormat,
          }),
        };
      }),
    [categories, config, pairs],
  );
  const pdfDraws = useMemo<LlavePdfDraw[]>(
    () =>
      draws
        .filter((draw) => draw.tree)
        .map((draw) => ({
          categoryName: draw.category.name,
          regulation: draw.regulation,
          pairCount: draw.pairCount,
          tree: draw.tree!,
          showOfficialId: draw.showOfficialId,
          startsAtRound: draw.startsAtRound,
          scheduleByOfficialId: draw.scheduleByOfficialId,
          resolveLabel: draw.resolveLabel,
        })),
    [draws],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="size-4 text-muted-foreground" />
          Llave
        </CardTitle>
        <CardDescription>
          Diagrama oficial del cuadro. Tocá Calcular para traer los nombres
          que clasificaron de zona.
        </CardDescription>
        <CardAction>
          <LlavePdfMenu
            tournamentName={tournamentName}
            draws={pdfDraws}
            club={club}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {draws.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna categoría tiene fase intermedia para armar la llave.
          </p>
        ) : (
          draws.map((draw) => (
            <section key={draw.category.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: draw.color }}
                  aria-hidden
                />
                <h3 className="text-sm font-medium">{draw.category.name}</h3>
                <span className="text-xs text-muted-foreground">
                  {draw.regulation} · {draw.pairCount} pareja
                  {draw.pairCount === 1 ? "" : "s"}
                </span>
              </div>
              {draw.tree ? (
                <OfficialBracketDiagram
                  root={draw.tree}
                  showOfficialId={draw.showOfficialId}
                  startsAtRound={draw.startsAtRound}
                  showPhaseLegend
                  scheduleByOfficialId={draw.scheduleByOfficialId}
                  resolveLabel={draw.resolveLabel}
                />
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  No hay llave {draw.regulation} para {draw.pairCount} parejas.
                </p>
              )}
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
