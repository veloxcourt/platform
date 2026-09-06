import type { MatchFormat } from "@/modules/tournaments/domain/config-schema";
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
}: {
  config: TournamentConfig | null;
  categoryId: string;
  pairs: PairListItem[];
  matchFormat: MatchFormat;
}): (label: string) => string {
  const category = config?.categories.find(
    (item) => item.categoryId === categoryId,
  );
  return buildKnockoutNameResolver({
    qualification: category
      ? qualificationFromCategory(category)
      : category?.zoneQualification,
    pairs: pairs.filter((pair) => pair.categoryId === categoryId),
    fixtures: [category?.intermediateFixture, category?.finalFixture],
    matchFormat,
  });
}
