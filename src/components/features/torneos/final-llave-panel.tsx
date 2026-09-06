"use client";

import { useMemo } from "react";
import { Workflow } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
import { StableTabButton } from "@/components/ui/stable-tab-button";
import { FINAL_PHASE_START_ROUND_LABELS } from "@/modules/tournaments/domain/config-schema";
import {
  eligiblePairCount,
  finalPhaseSettings,
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

export function FinalLlavePanel({
  tournamentName,
  categories,
  pairs,
  config,
  categoryId,
  onCategoryChange,
  club,
}: {
  tournamentName: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  club?: LlavePdfClub;
}) {
  const selected =
    categories.find((category) => category.id === categoryId) ??
    categories[0] ??
    null;
  const settings = finalPhaseSettings(config, selected?.id ?? "");
  const pairCount = selected ? eligiblePairCount(pairs, selected.id) : 0;
  const tree = useMemo(
    () =>
      selected
        ? officialLlaveTree(pairCount, settings.zone4Advancers)
        : null,
    [pairCount, selected, settings.zone4Advancers],
  );
  const scheduleByOfficialId = useMemo(() => {
    const categoryConfig = config?.categories.find(
      (item) => item.categoryId === selected?.id,
    );
    const map = bracketScheduleFromFixture(categoryConfig?.intermediateFixture);
    for (const [id, schedule] of bracketScheduleFromFixture(
      categoryConfig?.finalFixture,
    )) {
      map.set(id, schedule);
    }
    return map;
  }, [config, selected?.id]);
  const resolveLabel = useMemo(
    () =>
      selected
        ? categoryKnockoutNameResolver({
            config,
            categoryId: selected.id,
            pairs,
            matchFormat: settings.matchFormat,
          })
        : (label: string) => label,
    [config, pairs, selected, settings.matchFormat],
  );
  const pdfDraws = useMemo<LlavePdfDraw[]>(
    () =>
      tree && selected
        ? [
            {
              categoryName: selected.name,
              regulation: settings.zone4Advancers === 2 ? "APA" : "FAP",
              pairCount,
              tree,
              showOfficialId: settings.zone4Advancers === 3,
              startsAtRound: settings.startsAtRound,
              scheduleByOfficialId,
              resolveLabel,
            },
          ]
        : [],
    [
      pairCount,
      resolveLabel,
      scheduleByOfficialId,
      selected,
      settings.startsAtRound,
      settings.zone4Advancers,
      tree,
    ],
  );
  const regulation = settings.zone4Advancers === 2 ? "APA" : "FAP";
  const startsAtLabel = FINAL_PHASE_START_ROUND_LABELS[settings.startsAtRound];

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="size-4 text-muted-foreground" />
          Llaves{selected ? ` · ${selected.name}` : ""}
        </CardTitle>
        <CardAction>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LlavePdfMenu
              tournamentName={tournamentName}
              draws={pdfDraws}
              club={club}
            />
            <AyudaButton
              title="Ayuda de llave"
              description="Cómo se lee el cuadro de fase final."
            >
              <p>
                Elegí la categoría para ver el cuadro oficial. Ámbar es fase
                intermedia; violeta es fase final (desde {startsAtLabel}). Cada
                cruce muestra día, hora y cancha cuando ya hay armado.
              </p>
            </AyudaButton>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Agregá una categoría en Configuración → Categorías para armar la
            llave.
          </p>
        ) : (
          <>
            <div
              className="flex min-w-0 flex-wrap items-center gap-2"
              role="tablist"
              aria-label="Categoría de la llave"
            >
              {categories.map((category) => (
                <StableTabButton
                  key={category.id}
                  active={selected?.id === category.id}
                  onSelect={() => onCategoryChange(category.id)}
                >
                  {category.name}
                </StableTabButton>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Llave oficial {regulation} · {pairCount} pareja
              {pairCount === 1 ? "" : "s"} con compañero.
            </p>
            {tree ? (
              <OfficialBracketDiagram
                root={tree}
                showOfficialId={settings.zone4Advancers === 3}
                startsAtRound={settings.startsAtRound}
                showPhaseLegend
                scheduleByOfficialId={scheduleByOfficialId}
                resolveLabel={resolveLabel}
              />
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No hay llave {regulation} para {pairCount} parejas.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
