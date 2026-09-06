import type { MatchFormat } from "@/modules/tournaments/domain/config-schema";
import { defaultPhaseConfigs } from "@/modules/tournaments/domain/config-defaults";
import type { IntermediateFixturePersisted } from "@/modules/tournaments/domain/intermediate-fixture-schema";
import {
  buildKnockoutNameResolver,
  qualificationFromCategory,
} from "@/modules/tournaments/domain/zone-qualification";
import type {
  PairListItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";

export function categoryKnockoutNameResolver({
  config,
  categoryId,
  pairs,
  matchFormat,
  liveIntermediateFixture,
  liveFinalFixture,
}: {
  config: TournamentConfig | null;
  categoryId: string;
  pairs: PairListItem[];
  matchFormat: MatchFormat;
  liveIntermediateFixture?: IntermediateFixturePersisted | null;
  liveFinalFixture?: IntermediateFixturePersisted | null;
}): (label: string) => string {
  const category = config?.categories.find(
    (item) => item.categoryId === categoryId,
  );
  const defaults = defaultPhaseConfigs();
  return buildKnockoutNameResolver({
    qualification: category ? qualificationFromCategory(category) : null,
    pairs: pairs.filter((pair) => pair.categoryId === categoryId),
    fixtures: [
      {
        fixture: liveIntermediateFixture ?? category?.intermediateFixture,
        matchFormat:
          category?.phases.knockout.matchFormat ?? defaults.knockout.matchFormat,
      },
      {
        fixture: liveFinalFixture ?? category?.finalFixture,
        matchFormat:
          category?.phases.final.matchFormat ?? defaults.final.matchFormat,
      },
    ],
    matchFormat,
  });
}
