import {
  eligiblePairCount,
  finalPhaseSettings,
  intermediatePhaseSettings,
  officialLlaveTree,
} from "@/modules/tournaments/domain/intermediate-phase";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { categoryKnockoutNameResolver } from "./knockout-name-resolver";
import type { LlavePdfDraw } from "./llave-pdf";
import { bracketScheduleFromFixture } from "./official-bracket-diagram";

export function buildLlaveExportDraws({
  categories,
  pairs,
  config,
  includeFinalFixture,
}: {
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  includeFinalFixture: boolean;
}): LlavePdfDraw[] {
  return categories.flatMap((category) => {
    const settings = includeFinalFixture
      ? finalPhaseSettings(config, category.id)
      : intermediatePhaseSettings(config, category.id);
    const pairCount =
      eligiblePairCount(pairs, category.id) || category.pairCount;
    const tree = officialLlaveTree(pairCount, settings.zone4Advancers);
    if (!tree) return [];
    const categoryConfig = config?.categories.find(
      (item) => item.categoryId === category.id,
    );
    const schedule = bracketScheduleFromFixture(
      categoryConfig?.intermediateFixture,
    );
    if (includeFinalFixture) {
      for (const [id, match] of bracketScheduleFromFixture(
        categoryConfig?.finalFixture,
      )) {
        schedule.set(id, match);
      }
    }
    return [
      {
        categoryName: category.name,
        regulation: settings.zone4Advancers === 2 ? "APA" : "FAP",
        pairCount,
        tree,
        showOfficialId: settings.zone4Advancers === 3,
        startsAtRound: settings.startsAtRound,
        scheduleByOfficialId: schedule,
        resolveLabel: categoryKnockoutNameResolver({
          config,
          categoryId: category.id,
          pairs,
          matchFormat: settings.matchFormat,
        }),
      },
    ];
  });
}
