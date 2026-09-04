"use client";

import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MatchFormat } from "@/modules/tournaments/domain/config-schema";
import { MATCH_FORMAT_LABELS } from "@/modules/tournaments/domain/config-schema";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import {
  keysWithNoRestGap,
  ZONE_RULE_BREAK_LABELS,
  type ZoneRuleBreak,
} from "@/modules/tournaments/domain/build-zones-fixture";
import {
  resultColumnsForFormat,
  ZONE_MATCH_KIND_LABELS,
  type ZoneMatchKind,
  type ZoneResultColumn,
} from "@/modules/tournaments/domain/zone-bracket";

export type ZonePairOption = {
  id: string;
  label: string;
};

export type ZoneMatchDraft = {
  id: string;
  playDate: string;
  startTime: string;
  courtIndex: number | null;
  pair1Id: string | null;
  pair2Id: string | null;
  kind?: ZoneMatchKind;
  scores: Record<string, string>;
  /// Persistido desde el armado; la UI también lo recalcula en vivo.
  noRestGap?: boolean;
  ruleBreaks?: ZoneRuleBreak[];
};

export type ZoneDraft = {
  id: string;
  label: string;
  pairIds: string[];
  matches: ZoneMatchDraft[];
};

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const KIND_ROW_ORDER: Record<ZoneMatchKind, number> = {
  opening: 0,
  round_robin: 1,
  winners: 2,
  losers: 3,
};

const SCORE_CLASS =
  "h-8 w-10 rounded-lg border border-input bg-background px-1 text-center text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function pairLabel(
  pairId: string | null,
  options: ZonePairOption[],
): string {
  if (!pairId) return "—";
  return options.find((p) => p.id === pairId)?.label ?? "—";
}

/** Muestra el nombre completo (con wrap) y deja el select nativo solo para elegir. */
function PairSelect({
  value,
  options,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: ZonePairOption[];
  disabled?: boolean;
  onChange: (id: string | null) => void;
  ariaLabel: string;
}) {
  const label = pairLabel(value || null, options);
  return (
    <div className="relative min-w-0 rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <div
        aria-hidden
        className="min-h-8 px-1.5 py-1 pr-6 text-xs leading-snug break-words whitespace-normal"
      >
        {label}
      </div>
      <select
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={ariaLabel}
        title={label}
      >
        <option value="">—</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function ResultHeader({ columns }: { columns: ZoneResultColumn[] }) {
  const groups: { group: string; cols: ZoneResultColumn[] }[] = [];
  for (const col of columns) {
    const g = col.group ?? col.label;
    const last = groups[groups.length - 1];
    if (last && last.group === g) last.cols.push(col);
    else groups.push({ group: g, cols: [col] });
  }

  return (
    <th className="px-1 pb-1 pt-0 align-bottom">
      <div className="flex justify-end gap-0.5">
        {groups.map((g) => (
          <div
            key={g.group}
            className="flex min-w-0 flex-col items-center gap-0.5"
            style={{ width: `${g.cols.length * 2.75}rem` }}
          >
            <span className="text-[10px] font-medium text-muted-foreground">
              {g.group}
            </span>
            <div className="flex gap-0.5">
              {g.cols.map((c) => (
                <span
                  key={c.key}
                  className="w-10 text-center text-[10px] text-muted-foreground"
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </th>
  );
}

export function ZoneCard({
  zone,
  pairOptions,
  matchFormat,
  courtCount,
  dayOptions,
  dayOpenByDate,
  slotMinutes,
  readOnly = false,
  onChange,
  className,
}: {
  zone: ZoneDraft;
  pairOptions: ZonePairOption[];
  matchFormat: MatchFormat;
  courtCount: number;
  /// Días de fase de zonas (YYYY-MM-DD) con etiqueta opcional.
  dayOptions: { value: string; label: string }[];
  /// Apertura de cada día de juego (para ordenar madrugada overnight).
  dayOpenByDate?: Record<string, string>;
  /// Duración de celda (partido + intervalo) para detectar falta de descanso.
  slotMinutes?: number;
  readOnly?: boolean;
  onChange: (next: ZoneDraft) => void;
  className?: string;
}) {
  const columns = resultColumnsForFormat(matchFormat);
  const zonePairOptions = pairOptions.filter((p) =>
    zone.pairIds.includes(p.id),
  );
  const selectOptions =
    zonePairOptions.length > 0 ? zonePairOptions : pairOptions;

  const orderedMatches = [...zone.matches].sort((a, b) =>
    comparePlayDaySchedule(a, b, dayOpenByDate),
  );
  /// Tabla: 1.ª ronda primero; G/G y P/P al final. El descanso sigue el horario real.
  const tableMatches = [...zone.matches].sort((a, b) => {
    const kindCmp =
      (KIND_ROW_ORDER[a.kind ?? "round_robin"] ?? 1) -
      (KIND_ROW_ORDER[b.kind ?? "round_robin"] ?? 1);
    if (kindCmp !== 0) return kindCmp;
    return comparePlayDaySchedule(a, b, dayOpenByDate);
  });

  const computedNoRest =
    slotMinutes && slotMinutes > 0
      ? keysWithNoRestGap(
          orderedMatches.map((m) => ({
            key: m.id,
            playDate: m.playDate,
            startTime: m.startTime,
            // G/G y P/P aún no tienen rivales: se evalúa el descanso sobre toda la zona.
            pairIds:
              m.kind === "winners" || m.kind === "losers"
                ? zone.pairIds
                : [m.pair1Id, m.pair2Id],
          })),
          dayOpenByDate,
          slotMinutes,
        )
      : new Set<string>();

  // Unión: el fixture puede marcar noRestGap aunque el cálculo local use otro slotMinutes.
  const noRestGapIds = new Set<string>([
    ...computedNoRest,
    ...orderedMatches.filter((m) => m.noRestGap).map((m) => m.id),
  ]);

  const hasUnscheduled = orderedMatches.some(
    (m) => !m.playDate.trim() || !m.startTime.trim(),
  );
  const informedBreaks = orderedMatches.flatMap((m) => m.ruleBreaks ?? []);
  const hasDayPrefBreak = informedBreaks.includes("day_pref");
  const hasCellPrefBreak = informedBreaks.includes("cell_pref");
  /// Zona fuera de regla: falta horario o alguna pareja sin celda de descanso.
  const zoneNeedsReview = noRestGapIds.size > 0 || hasUnscheduled;

  function updateMatch(matchId: string, patch: Partial<ZoneMatchDraft>) {
    const nextMatches = zone.matches.map((m) =>
      m.id === matchId ? { ...m, ...patch } : m,
    );
    const touchesSchedule =
      "playDate" in patch ||
      "startTime" in patch ||
      "pair1Id" in patch ||
      "pair2Id" in patch;
    onChange({
      ...zone,
      matches: touchesSchedule
        ? [...nextMatches].sort((a, b) =>
            comparePlayDaySchedule(a, b, dayOpenByDate),
          )
        : nextMatches,
    });
  }

  function updateScore(matchId: string, key: string, value: string) {
    const match = zone.matches.find((m) => m.id === matchId);
    if (!match) return;
    updateMatch(matchId, {
      scores: { ...match.scores, [key]: value.replace(/\D/g, "").slice(0, 2) },
    });
  }

  return (
    <div
      title={
        zoneNeedsReview
          ? "Esta zona quedó fuera de alguna regla (horario o descanso). Revisá y ajustá a mano."
          : undefined
      }
      className={cn(
        "rounded-lg border p-3",
        zoneNeedsReview
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
          : "border-teal-200/80 bg-teal-50/80 dark:border-teal-900 dark:bg-teal-950/30",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{zone.label}</p>
            {zoneNeedsReview && (
              <span className="rounded-md border border-amber-500/60 bg-amber-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-950 dark:border-amber-600 dark:bg-amber-900/60 dark:text-amber-100">
                Revisar
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {zone.matches.length} partido
            {zone.matches.length === 1 ? "" : "s"} ·{" "}
            {MATCH_FORMAT_LABELS[matchFormat]}
            {noRestGapIds.size > 0
              ? " · sin descanso en algún partido"
              : null}
            {hasDayPrefBreak ? " · pref. de día no respetada" : null}
            {hasCellPrefBreak ? " · pref. de horario no respetada" : null}
            {hasUnscheduled ? " · horario incompleto" : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {zone.pairIds.length === 0 ? (
            <span className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
              Sin parejas asignadas
            </span>
          ) : (
            zone.pairIds.map((id) => (
              <span
                key={id}
                className={cn(
                  "rounded-md border bg-background/80 px-2 py-1 text-xs",
                  zoneNeedsReview
                    ? "border-amber-300/80"
                    : "border-teal-200/80",
                )}
              >
                {pairLabel(id, pairOptions)}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-8" />
            <col className="w-[6.5rem]" />
            <col className="w-16" />
            <col className="w-[5rem]" />
            <col />
            <col />
            <col style={{ width: `${Math.max(1, columns.length) * 2.75}rem` }} />
          </colgroup>
          <thead>
            <tr className="border-b text-[11px] text-muted-foreground">
              <th className="py-1.5 pr-1.5 font-medium">#</th>
              <th className="py-1.5 pr-1.5 font-medium">Día</th>
              <th className="py-1.5 pr-1.5 font-medium">Horario</th>
              <th className="py-1.5 pr-1.5 font-medium">Cancha</th>
              <th className="py-1.5 pr-1.5 font-medium">Pareja 1</th>
              <th className="py-1.5 pr-1.5 font-medium">Pareja 2</th>
              <ResultHeader columns={columns} />
            </tr>
          </thead>
          <tbody>
            {tableMatches.map((match, index) => {
              const lacksRest = noRestGapIds.has(match.id);
              const lacksSchedule =
                !match.playDate.trim() || !match.startTime.trim();
              const infoBreaks = (match.ruleBreaks ?? []).filter(
                (breakKey) => breakKey !== "rest",
              );
              const rowNeedsReview = lacksRest || lacksSchedule;
              const rowTitle = [
                lacksRest
                  ? "Sin celda de descanso entre partidos de una pareja — revisá horario"
                  : null,
                lacksSchedule ? "Partido sin día u horario asignado" : null,
                ...infoBreaks.map(
                  (breakKey) =>
                    `${ZONE_RULE_BREAK_LABELS[breakKey]}: otra regla dura (oleada) tuvo prioridad`,
                ),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
              <tr
                key={match.id}
                title={rowTitle || undefined}
                className={cn(
                  "border-b border-dashed last:border-0",
                  rowNeedsReview &&
                    "bg-amber-200/70 dark:bg-amber-900/50",
                )}
              >
                <td className="py-1.5 pr-1.5 align-middle tabular-nums text-muted-foreground">
                  <div className="flex flex-col">
                    <span>{index + 1}</span>
                    {lacksRest && (
                      <span className="max-w-[4.5rem] text-[9px] font-medium leading-tight text-amber-900 dark:text-amber-100">
                        Sin descanso
                      </span>
                    )}
                    {lacksSchedule ? (
                      <span className="max-w-[4.5rem] text-[9px] font-medium leading-tight text-amber-900 dark:text-amber-100">
                        Sin horario
                      </span>
                    ) : null}
                    {infoBreaks.map((breakKey) => (
                      <span
                        key={breakKey}
                        className="max-w-[4.5rem] text-[9px] font-medium leading-tight text-sky-800 dark:text-sky-200"
                      >
                        {ZONE_RULE_BREAK_LABELS[breakKey]}
                      </span>
                    ))}
                    {match.kind &&
                      (match.kind === "winners" ||
                        match.kind === "losers" ||
                        match.kind === "opening") && (
                        <span className="max-w-[4.5rem] text-[9px] leading-tight text-muted-foreground/80">
                          {ZONE_MATCH_KIND_LABELS[match.kind]}
                        </span>
                      )}
                  </div>
                </td>
                <td className="py-1.5 pr-1.5 align-middle">
                  <select
                    className={SELECT_CLASS}
                    value={match.playDate}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateMatch(match.id, { playDate: e.target.value })
                    }
                    aria-label={`Día partido ${index + 1}`}
                  >
                    <option value="">—</option>
                    {dayOptions.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-1.5 align-middle">
                  <Input
                    value={match.startTime}
                    placeholder="17:00"
                    className="h-8 w-full min-w-0 px-1.5 text-center text-xs tabular-nums"
                    disabled={readOnly}
                    readOnly={readOnly}
                    onChange={(e) =>
                      updateMatch(match.id, { startTime: e.target.value })
                    }
                    aria-label={`Horario partido ${index + 1}`}
                  />
                </td>
                <td className="py-1.5 pr-1.5 align-middle">
                  <select
                    className={SELECT_CLASS}
                    value={match.courtIndex ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateMatch(match.id, {
                        courtIndex:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                    aria-label={`Cancha partido ${index + 1}`}
                  >
                    <option value="">—</option>
                    {Array.from({ length: Math.max(1, courtCount) }, (_, i) => (
                      <option key={i} value={i}>
                        Cancha {i + 1}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="min-w-0 py-1.5 pr-1.5 align-middle">
                  <PairSelect
                    value={match.pair1Id ?? ""}
                    options={selectOptions}
                    disabled={readOnly}
                    onChange={(id) => updateMatch(match.id, { pair1Id: id })}
                    ariaLabel={`Pareja 1 partido ${index + 1}`}
                  />
                </td>
                <td className="min-w-0 py-1.5 pr-1.5 align-middle">
                  <PairSelect
                    value={match.pair2Id ?? ""}
                    options={selectOptions}
                    disabled={readOnly}
                    onChange={(id) => updateMatch(match.id, { pair2Id: id })}
                    ariaLabel={`Pareja 2 partido ${index + 1}`}
                  />
                </td>
                <td className="py-1.5 align-middle">
                  <div className="flex justify-end gap-0.5">
                    {columns.map((col) => (
                      <input
                        key={col.key}
                        className={SCORE_CLASS}
                        inputMode="numeric"
                        value={match.scores[col.key] ?? ""}
                        disabled={readOnly}
                        readOnly={readOnly}
                        onChange={(e) =>
                          updateScore(match.id, col.key, e.target.value)
                        }
                        aria-label={`${col.group ?? ""} ${col.label} partido ${index + 1}`}
                      />
                    ))}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
