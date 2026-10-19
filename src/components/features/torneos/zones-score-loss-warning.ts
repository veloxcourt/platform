import { previewZonesScoreLossAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import type { PairListItem } from "@/modules/tournaments/domain/types";
import { describeZoneScoreLossReason } from "@/modules/tournaments/domain/zones-score-loss";
import type { ActualizarWarning } from "./actualizar-confirm-button";

function resultsLabel(count: number) {
  return `${count} resultado${count === 1 ? "" : "s"}`;
}

export async function loadZonesScoreLossWarning(params: {
  clubSlug: string;
  tournamentId: string;
  categoryId?: string;
  pairs: PairListItem[];
}): Promise<ActualizarWarning | null> {
  const preview = await previewZonesScoreLossAction(
    params.clubSlug,
    params.tournamentId,
    params.categoryId,
  );
  if (!preview.ok) {
    return {
      title: "No se pudo revisar si se pierden resultados",
      description: preview.error,
      groups: [],
    };
  }
  if (preview.categories.length === 0) return null;

  const labelById = new Map(
    params.pairs.map((pair) => [
      pair.id,
      formatAbbreviatedPairLabel(pair.player1.name, pair.player2?.name ?? null),
    ]),
  );
  const pairLabel = (id: string) => labelById.get(id) ?? "Una pareja";

  let total = 0;
  const groups: ActualizarWarning["groups"] = [];
  for (const category of preview.categories) {
    const showCategory = category.categoryId !== params.categoryId;
    for (const zone of category.zones) {
      total += zone.lostCount;
      groups.push({
        heading: `${showCategory ? `${category.categoryName} · ` : ""}${zone.zoneLabel}: se pierde${zone.lostCount === 1 ? "" : "n"} ${resultsLabel(zone.lostCount)}`,
        reasons: zone.reasons.map((reason) =>
          describeZoneScoreLossReason(reason, zone.zoneLabel, pairLabel),
        ),
      });
    }
  }

  return {
    title: `Actualizar borra ${resultsLabel(total)} ya cargado${total === 1 ? "" : "s"}`,
    description:
      "Un resultado se conserva solo si el partido sigue en la misma zona y entre las mismas dos parejas.",
    groups,
  };
}
