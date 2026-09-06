import type { MatchFormat } from "./config-schema";
import {
  advancersFromZoneSize,
  type ZoneMatchKind,
} from "./zone-bracket";

export type ZoneStandingMatchInput = {
  pair1Id: string | null;
  pair2Id: string | null;
  kind?: ZoneMatchKind;
  scores: Record<string, string>;
};

export type ZoneStandingOutcome = "advance" | "out" | "playoff" | "pending";

export type ZoneStandingRow = {
  pairId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  gamesFor: number;
  gamesAgainst: number;
  gameDiff: number;
  /// Puesto en papel; null si el grupo sigue empatado.
  rank: number | null;
  outcome: ZoneStandingOutcome;
  outcomeLabel: string;
  /// Empate que se define (o ya se definió) en cancha.
  tieGroupKey?: string;
  tieGroupStart?: number;
  tieGroupSize?: number;
  courtDefined?: boolean;
};

export type ZoneTieBreakDecision = {
  pairIds: string[];
  orderedPairIds: string[];
};

export function samePairSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

export function upsertZoneTieBreak(
  current: ZoneTieBreakDecision[] | undefined,
  groupPairIds: string[],
  orderedPairIds: string[],
): ZoneTieBreakDecision[] {
  const next = (current ?? []).filter(
    (item) => !samePairSet(item.pairIds, groupPairIds),
  );
  next.push({
    pairIds: [...groupPairIds].sort(),
    orderedPairIds,
  });
  return next;
}

export function orderAfterPickingPlace(
  groupPairIds: string[],
  pickedPairId: string,
  placeInGroup: number,
  previousOrder?: string[],
): string[] {
  const rest = groupPairIds.filter((id) => id !== pickedPairId);
  const preferred = (previousOrder ?? []).filter(
    (id) => id !== pickedPairId && rest.includes(id),
  );
  const fill = [
    ...preferred,
    ...rest.filter((id) => !preferred.includes(id)),
  ];
  const ordered = new Array<string>(groupPairIds.length);
  ordered[placeInGroup] = pickedPairId;
  let index = 0;
  for (let slot = 0; slot < ordered.length; slot += 1) {
    if (!ordered[slot]) ordered[slot] = fill[index++]!;
  }
  return ordered;
}

export type ZoneStandingsResult = {
  rows: ZoneStandingRow[];
  completeMatches: number;
  pendingMatches: number;
  totalMatches: number;
  advancers: number;
  regulation: "FAP" | "APA";
  mode: "round_robin" | "zone4_bracket";
  note: string;
  pendingReasons: string[];
};

type SetScore = { a: number; b: number };

function parseGames(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function readSet(
  scores: Record<string, string>,
  aKey: string,
  bKey: string,
): SetScore | null {
  const a = parseGames(scores[aKey]);
  const b = parseGames(scores[bKey]);
  if (a == null || b == null) return null;
  return { a, b };
}

function setWinner(set: SetScore): 1 | 2 | null {
  if (set.a === set.b) return null;
  return set.a > set.b ? 1 : 2;
}

function collectSets(
  format: MatchFormat,
  scores: Record<string, string>,
): { sets: SetScore[]; complete: boolean } {
  if (format === "ONE_SET_6" || format === "ONE_SET_9") {
    const set = readSet(scores, "s1a", "s1b");
    if (!set || !setWinner(set)) return { sets: [], complete: false };
    return { sets: [set], complete: true };
  }

  const set1 = readSet(scores, "s1a", "s1b");
  const set2 = readSet(scores, "s2a", "s2b");
  if (!set1 || !set2 || !setWinner(set1) || !setWinner(set2)) {
    return { sets: [], complete: false };
  }

  const w1 = setWinner(set1)!;
  const w2 = setWinner(set2)!;
  if (w1 === w2) return { sets: [set1, set2], complete: true };

  if (format === "TWO_SETS_STB") {
    const stb = readSet(scores, "stba", "stbb");
    if (!stb || !setWinner(stb)) return { sets: [set1, set2], complete: false };
    return { sets: [set1, set2, stb], complete: true };
  }

  const set3 =
    readSet(scores, "s3a", "s3b") ?? readSet(scores, "stba", "stbb");
  if (!set3 || !setWinner(set3)) return { sets: [set1, set2], complete: false };
  return { sets: [set1, set2, set3], complete: true };
}

export function evaluateZoneMatch(
  match: ZoneStandingMatchInput,
  format: MatchFormat,
): {
  complete: boolean;
  winnerPairId: string | null;
  loserPairId: string | null;
  setsWon1: number;
  setsWon2: number;
  games1: number;
  games2: number;
} {
  const empty = {
    complete: false,
    winnerPairId: null,
    loserPairId: null,
    setsWon1: 0,
    setsWon2: 0,
    games1: 0,
    games2: 0,
  };
  if (!match.pair1Id || !match.pair2Id || match.pair1Id === match.pair2Id) {
    return empty;
  }
  const { sets, complete } = collectSets(format, match.scores);
  if (!complete) return empty;

  let setsWon1 = 0;
  let setsWon2 = 0;
  let games1 = 0;
  let games2 = 0;
  for (const set of sets) {
    games1 += set.a;
    games2 += set.b;
    if (setWinner(set) === 1) setsWon1 += 1;
    else setsWon2 += 1;
  }
  if (setsWon1 === setsWon2) return empty;
  const pair1Wins = setsWon1 > setsWon2;
  return {
    complete: true,
    winnerPairId: pair1Wins ? match.pair1Id : match.pair2Id,
    loserPairId: pair1Wins ? match.pair2Id : match.pair1Id,
    setsWon1,
    setsWon2,
    games1,
    games2,
  };
}

type PairStats = {
  pairId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsWon: number;
  setsLost: number;
  gamesFor: number;
  gamesAgainst: number;
};

function emptyStats(pairId: string): PairStats {
  return {
    pairId,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    setsWon: 0,
    setsLost: 0,
    gamesFor: 0,
    gamesAgainst: 0,
  };
}

function applyMatch(stats: Map<string, PairStats>, match: ZoneStandingMatchInput, format: MatchFormat) {
  const result = evaluateZoneMatch(match, format);
  if (!result.complete || !match.pair1Id || !match.pair2Id) return result;
  const left = stats.get(match.pair1Id);
  const right = stats.get(match.pair2Id);
  if (!left || !right) return result;

  left.played += 1;
  right.played += 1;
  left.setsWon += result.setsWon1;
  left.setsLost += result.setsWon2;
  right.setsWon += result.setsWon2;
  right.setsLost += result.setsWon1;
  left.gamesFor += result.games1;
  left.gamesAgainst += result.games2;
  right.gamesFor += result.games2;
  right.gamesAgainst += result.games1;

  if (result.winnerPairId === match.pair1Id) {
    left.won += 1;
    left.points += 2;
    right.lost += 1;
    right.points += 1;
  } else {
    right.won += 1;
    right.points += 2;
    left.lost += 1;
    left.points += 1;
  }
  return result;
}

function compareFap(a: PairStats, b: PairStats): number {
  return (
    b.points - a.points ||
    b.setsWon - b.setsLost - (a.setsWon - a.setsLost) ||
    b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst) ||
    b.gamesFor - a.gamesFor ||
    a.gamesAgainst - b.gamesAgainst
  );
}

function ordinalEs(n: number): string {
  return `${n}.ª`;
}

function outcomeForRank(
  rank: number,
  advancers: number,
): { outcome: ZoneStandingOutcome; outcomeLabel: string } {
  if (rank <= advancers) {
    if (rank === 1) return { outcome: "advance", outcomeLabel: "1.ª · pasa" };
    if (rank === 2) return { outcome: "advance", outcomeLabel: "2.ª · pasa" };
    return {
      outcome: "advance",
      outcomeLabel: `${ordinalEs(rank)} · pasa`,
    };
  }
  return { outcome: "out", outcomeLabel: `${ordinalEs(rank)} · afuera` };
}

function toRow(stats: PairStats, rank: number | null, outcome: ZoneStandingOutcome, outcomeLabel: string): ZoneStandingRow {
  return {
    pairId: stats.pairId,
    played: stats.played,
    won: stats.won,
    lost: stats.lost,
    points: stats.points,
    setsWon: stats.setsWon,
    setsLost: stats.setsLost,
    setDiff: stats.setsWon - stats.setsLost,
    gamesFor: stats.gamesFor,
    gamesAgainst: stats.gamesAgainst,
    gameDiff: stats.gamesFor - stats.gamesAgainst,
    rank,
    outcome,
    outcomeLabel,
  };
}

function assignFapOutcomes(
  ordered: PairStats[],
  advancers: number,
  pending: boolean,
): ZoneStandingRow[] {
  const rows: ZoneStandingRow[] = [];
  let index = 0;
  while (index < ordered.length) {
    let end = index + 1;
    while (end < ordered.length && compareFap(ordered[index]!, ordered[end]!) === 0) {
      end += 1;
    }
    const group = ordered.slice(index, end);
    const firstPos = index + 1;
    const lastPos = end;
    const allAdvance = lastPos <= advancers;
    const allOut = firstPos > advancers;

    if (pending) {
      for (const stats of group) {
        rows.push(
          toRow(
            stats,
            group.length === 1 ? firstPos : null,
            "pending",
            "Pendiente · faltan partidos",
          ),
        );
      }
    } else if (group.length === 1) {
      const assigned = outcomeForRank(firstPos, advancers);
      rows.push(toRow(group[0]!, firstPos, assigned.outcome, assigned.outcomeLabel));
    } else if (allAdvance) {
      const label =
        firstPos === 1 && lastPos === 2
          ? "1.ª / 2.ª · definir en cancha"
          : `${ordinalEs(firstPos)}–${ordinalEs(lastPos)} · pasan · definir orden`;
      const tie = tieGroupFields(group, firstPos);
      for (const stats of group) {
        rows.push({
          ...toRow(stats, null, "playoff", label),
          ...tie,
        });
      }
    } else if (allOut) {
      for (const stats of group) {
        rows.push(toRow(stats, null, "out", `${ordinalEs(firstPos)}–${ordinalEs(lastPos)} · afuera`));
      }
    } else {
      const tie = tieGroupFields(group, firstPos);
      for (const stats of group) {
        rows.push({
          ...toRow(
            stats,
            null,
            "playoff",
            "Empate · definir en cancha quién pasa",
          ),
          ...tie,
        });
      }
    }
    index = end;
  }
  return rows;
}

function tieGroupFields(
  group: PairStats[],
  firstPos: number,
): Pick<ZoneStandingRow, "tieGroupKey" | "tieGroupStart" | "tieGroupSize"> {
  return {
    tieGroupKey: group.map((item) => item.pairId).sort().join("|"),
    tieGroupStart: firstPos,
    tieGroupSize: group.length,
  };
}

function applyTieBreaks(
  rows: ZoneStandingRow[],
  advancers: number,
  tieBreaks: ZoneTieBreakDecision[] | undefined,
): ZoneStandingRow[] {
  if (!tieBreaks?.length) return rows;
  const next = [...rows];
  const seen = new Set<string>();
  for (let index = 0; index < next.length; index += 1) {
    const key = next[index]?.tieGroupKey;
    const start = next[index]?.tieGroupStart;
    const size = next[index]?.tieGroupSize;
    if (!key || start == null || !size || seen.has(key)) continue;
    seen.add(key);
    const group = next.filter((row) => row.tieGroupKey === key);
    const groupIds = group.map((row) => row.pairId);
    const decision = tieBreaks.find(
      (item) =>
        samePairSet(item.pairIds, groupIds) &&
        samePairSet(item.orderedPairIds, groupIds),
    );
    if (!decision) continue;
    const resolved = decision.orderedPairIds.map((pairId, offset) => {
      const row = group.find((item) => item.pairId === pairId)!;
      const rank = start + offset;
      const assigned = outcomeForRank(rank, advancers);
      return {
        ...row,
        rank,
        outcome: assigned.outcome,
        outcomeLabel: `${assigned.outcomeLabel} · en cancha`,
        courtDefined: true,
        tieGroupKey: key,
        tieGroupStart: start,
        tieGroupSize: size,
      };
    });
    let writeAt = next.findIndex((row) => row.tieGroupKey === key);
    for (const row of resolved) {
      while (writeAt < next.length && next[writeAt]?.tieGroupKey !== key) {
        writeAt += 1;
      }
      if (writeAt < next.length) {
        next[writeAt] = row;
        writeAt += 1;
      }
    }
  }
  return next.sort((a, b) => {
    const rankA = a.rank ?? 99;
    const rankB = b.rank ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });
}

function inferOpeningSides(matches: ZoneStandingMatchInput[], format: MatchFormat) {
  const winners: string[] = [];
  const losers: string[] = [];
  for (const match of matches) {
    if (match.kind && match.kind !== "opening") continue;
    const result = evaluateZoneMatch(match, format);
    if (result.winnerPairId) winners.push(result.winnerPairId);
    if (result.loserPairId) losers.push(result.loserPairId);
  }
  return { winners, losers };
}

function assignZone4Bracket(
  statsById: Map<string, PairStats>,
  pairIds: string[],
  matches: ZoneStandingMatchInput[],
  format: MatchFormat,
  advancers: number,
): { rows: ZoneStandingRow[]; pendingReasons: string[] } | null {
  const openings = matches.filter((match) => match.kind === "opening");
  if (openings.length === 0) return null;

  const winnersMatch = matches.find((match) => match.kind === "winners");
  const losersMatch = matches.find((match) => match.kind === "losers");
  const inferred = inferOpeningSides(matches, format);
  const winnersEval = winnersMatch
    ? evaluateZoneMatch(winnersMatch, format)
    : { complete: false, winnerPairId: null, loserPairId: null };
  const losersEval = losersMatch
    ? evaluateZoneMatch(losersMatch, format)
    : { complete: false, winnerPairId: null, loserPairId: null };

  const first = winnersEval.winnerPairId;
  const second = winnersEval.loserPairId;
  const third = losersEval.winnerPairId;
  const fourth = losersEval.loserPairId;
  const pendingReasons: string[] = [];

  const placed = new Map<
    string,
    { rank: number; outcome: ZoneStandingOutcome; label: string }
  >();

  if (first && second) {
    const firstPlace = outcomeForRank(1, advancers);
    const secondPlace = outcomeForRank(2, advancers);
    placed.set(first, {
      rank: 1,
      outcome: firstPlace.outcome,
      label: firstPlace.outcomeLabel,
    });
    placed.set(second, {
      rank: 2,
      outcome: secondPlace.outcome,
      label: secondPlace.outcomeLabel,
    });
  } else if (inferred.winners.length > 0) {
    pendingReasons.push("Falta el ganador vs ganador para definir 1.ª y 2.ª.");
    for (const pairId of inferred.winners) {
      placed.set(pairId, {
        rank: 0,
        outcome: "pending",
        label: advancers >= 2 ? "1.ª o 2.ª · falta G/G" : "Pendiente · falta G/G",
      });
    }
  }

  if (third && fourth) {
    const thirdPlace = outcomeForRank(3, advancers);
    const fourthPlace = outcomeForRank(4, advancers);
    placed.set(third, {
      rank: 3,
      outcome: thirdPlace.outcome,
      label: thirdPlace.outcomeLabel,
    });
    placed.set(fourth, {
      rank: 4,
      outcome: fourthPlace.outcome,
      label: fourthPlace.outcomeLabel,
    });
  } else if (inferred.losers.length > 0) {
    pendingReasons.push("Falta el perdedor vs perdedor para definir 3.ª y 4.ª.");
    for (const pairId of inferred.losers) {
      placed.set(pairId, {
        rank: 0,
        outcome: "pending",
        label:
          advancers >= 3 ? "3.ª o 4.ª · falta P/P" : "3.ª / 4.ª · afuera (falta P/P)",
      });
    }
  }

  if (placed.size === 0) return null;

  const rows = pairIds.map((pairId) => {
    const stats = statsById.get(pairId) ?? emptyStats(pairId);
    const place = placed.get(pairId);
    if (!place) {
      return toRow(stats, null, "pending", "Pendiente · faltan partidos");
    }
    return toRow(
      stats,
      place.rank > 0 ? place.rank : null,
      place.outcome,
      place.label,
    );
  });

  rows.sort((a, b) => {
    const ra = a.rank ?? 99;
    const rb = b.rank ?? 99;
    if (ra !== rb) return ra - rb;
    return compareFap(
      statsById.get(a.pairId) ?? emptyStats(a.pairId),
      statsById.get(b.pairId) ?? emptyStats(b.pairId),
    );
  });

  return { rows, pendingReasons };
}

export function formatSignedDiff(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function computeZoneStandings({
  pairIds,
  matches,
  format,
  zone4Advancers = 3,
  tieBreaks,
}: {
  pairIds: string[];
  matches: ZoneStandingMatchInput[];
  format: MatchFormat;
  zone4Advancers?: 2 | 3;
  tieBreaks?: ZoneTieBreakDecision[];
}): ZoneStandingsResult {
  const ids = pairIds.filter(Boolean);
  const statsById = new Map(ids.map((id) => [id, emptyStats(id)]));
  let completeMatches = 0;
  for (const match of matches) {
    const result = applyMatch(statsById, match, format);
    if (result.complete) completeMatches += 1;
  }

  const advancers = advancersFromZoneSize(ids.length, zone4Advancers);
  const regulation = zone4Advancers === 2 ? "APA" : "FAP";
  const pendingMatches = Math.max(0, matches.length - completeMatches);
  const isZone4 = ids.length >= 4 && matches.some((match) => match.kind === "opening");

  if (isZone4) {
    const bracket = assignZone4Bracket(
      statsById,
      ids,
      matches,
      format,
      advancers,
    );
    if (bracket) {
      return {
        rows: bracket.rows,
        completeMatches,
        pendingMatches,
        totalMatches: matches.length,
        advancers,
        regulation,
        mode: "zone4_bracket",
        note:
          regulation === "FAP"
            ? "Zona de 4 FAP: 1.ª y 2.ª salen del G/G; 3.ª es la ganadora del P/P. Pasan 3."
            : "Zona de 4 APA: pasan 1.ª y 2.ª del G/G. Las del P/P quedan afuera.",
        pendingReasons: bracket.pendingReasons,
      };
    }
  }

  const ordered = [...statsById.values()].sort((a, b) => compareFap(a, b));
  const pending = pendingMatches > 0 || completeMatches === 0;
  const rows = applyTieBreaks(
    assignFapOutcomes(ordered, advancers, pending && completeMatches === 0),
    advancers,
    tieBreaks,
  );
  return {
    rows,
    completeMatches,
    pendingMatches,
    totalMatches: matches.length,
    advancers,
    regulation,
    mode: "round_robin",
    note:
      "FAP: 2 pts victoria, 1 pt derrota jugada. Desempate: diff. de sets, diff. de games, games a favor, games en contra. Si sigue el empate, definilo acá (1.ª / 2.ª). Esa elección queda guardada.",
    pendingReasons:
      pendingMatches > 0
        ? [`Faltan ${pendingMatches} resultado${pendingMatches === 1 ? "" : "s"}.`]
        : [],
  };
}
