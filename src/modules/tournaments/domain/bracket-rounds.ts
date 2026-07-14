import {
  FINAL_PHASE_START_ROUND_LABELS,
  FINAL_PHASE_START_ROUND_VALUES,
  type FinalPhaseStartRound,
} from "./config-schema";

const PAIR_COUNT_BY_ROUND: Record<FinalPhaseStartRound, number> = {
  ROUND_32: 32,
  ROUND_16: 16,
  QUARTER_FINALS: 8,
  SEMI_FINALS: 4,
};

/// Rondas que se juegan en la fase intermedia (todas las anteriores al inicio de la final).
export function intermediateRounds(
  finalStartsAt: FinalPhaseStartRound,
): FinalPhaseStartRound[] {
  const finalIdx = FINAL_PHASE_START_ROUND_VALUES.indexOf(finalStartsAt);
  return FINAL_PHASE_START_ROUND_VALUES.slice(0, finalIdx);
}

export function intermediateRoundLabels(
  finalStartsAt: FinalPhaseStartRound,
): string[] {
  return intermediateRounds(finalStartsAt).map(
    (round) => FINAL_PHASE_START_ROUND_LABELS[round],
  );
}

/// Partidos de la fase intermedia asumiendo llave desde `bracketSize` (p. ej. 32 parejas).
export function intermediateMatchCount(
  finalStartsAt: FinalPhaseStartRound,
  bracketSize: FinalPhaseStartRound = "ROUND_32",
): number {
  const startIdx = FINAL_PHASE_START_ROUND_VALUES.indexOf(bracketSize);
  const finalIdx = FINAL_PHASE_START_ROUND_VALUES.indexOf(finalStartsAt);
  if (startIdx < 0 || finalIdx < 0 || startIdx >= finalIdx) return 0;

  let total = 0;
  for (let i = startIdx; i < finalIdx; i++) {
    const round = FINAL_PHASE_START_ROUND_VALUES[i];
    total += PAIR_COUNT_BY_ROUND[round] / 2;
  }
  return total;
}
