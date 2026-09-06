"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MatchFormat } from "@/modules/tournaments/domain/config-schema";
import { MATCH_FORMAT_LABELS } from "@/modules/tournaments/domain/config-schema";
import type { FapCrossing } from "@/modules/tournaments/domain/fap-llaves";
import {
  resultColumnsForFormat,
  type ZoneResultColumn,
} from "@/modules/tournaments/domain/zone-bracket";
import { ScoreTapPicker } from "./score-tap-picker";

const SCORE_CLASS =
  "h-8 w-10 select-none rounded-lg border border-input bg-muted/40 px-1 text-center text-xs tabular-nums outline-none disabled:opacity-60";

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

export type IntermediateCrossingSchedule = {
  playDate: string | null;
  startTime: string | null;
  courtIndex: number | null;
  noRestGap?: boolean;
};

function ScheduleSlotCell({
  value,
  align = "left",
  disabled,
  title,
  ariaLabel,
  onPick,
}: {
  value: string;
  align?: "left" | "center";
  disabled?: boolean;
  title?: string;
  ariaLabel: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-1.5 text-xs",
        align === "center" && "text-center tabular-nums",
        !disabled && "cursor-pointer hover:bg-muted",
        disabled && "cursor-default opacity-80",
      )}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onClick={() => {
        if (disabled) return;
        onPick();
      }}
    >
      {value}
    </button>
  );
}

export function IntermediateRoundCard({
  label,
  crossings,
  matchFormat,
  dayOptions,
  showOfficialId,
  scheduleByOfficialId,
  canReorder = false,
  canPickSlot = false,
  onMove,
  onPickSchedule,
  scoresByOfficialId,
  onScoreChange,
  scoresReadOnly = false,
  resolveLabel,
}: {
  label: string;
  crossings: FapCrossing[];
  matchFormat: MatchFormat;
  dayOptions: { value: string; label: string }[];
  showOfficialId: boolean;
  scheduleByOfficialId?: Map<number, IntermediateCrossingSchedule>;
  canReorder?: boolean;
  canPickSlot?: boolean;
  onMove?: (officialId: number, direction: "up" | "down") => void;
  onPickSchedule?: (officialId: number) => void;
  scoresByOfficialId?: Map<number, Record<string, string>>;
  onScoreChange?: (officialId: number, key: string, value: string) => void;
  scoresReadOnly?: boolean;
  resolveLabel?: (label: string) => string;
}) {
  const columns = resultColumnsForFormat(matchFormat);
  const [scorePicker, setScorePicker] = useState<{
    officialId: number;
    startKey: string;
  } | null>(null);
  const scoreLocked = scoresReadOnly || !onScoreChange;
  const pickerCrossing = scorePicker
    ? crossings.find((crossing) => crossing.id === scorePicker.officialId)
    : null;
  const hasUnscheduled = crossings.some((crossing) => {
    const schedule = scheduleByOfficialId?.get(crossing.id);
    return !schedule?.playDate || !schedule.startTime;
  });
  const hasNoRest = crossings.some(
    (crossing) => scheduleByOfficialId?.get(crossing.id)?.noRestGap,
  );
  const needsReview = hasUnscheduled || hasNoRest;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        needsReview
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
          : "border-border bg-card",
      )}
    >
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{label}</p>
          {needsReview ? (
            <span className="rounded-md border border-amber-500/60 bg-amber-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-950 dark:border-amber-600 dark:bg-amber-900/60 dark:text-amber-100">
              Revisar
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {crossings.length} partido
          {crossings.length === 1 ? "" : "s"} · {MATCH_FORMAT_LABELS[matchFormat]}
          {hasUnscheduled ? " · horario incompleto" : null}
          {canReorder
            ? " · flechas: intercambiar horario con el de arriba o abajo"
            : null}
          {canPickSlot
            ? " · día, horario y cancha: regla de slots (el partido no cambia de fila)"
            : null}
        </p>
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
            {crossings.map((crossing, index) => {
              const schedule = scheduleByOfficialId?.get(crossing.id);
              const unscheduled =
                !schedule?.playDate || !schedule.startTime;
              return (
              <tr
                key={`${label}-${crossing.id}-${index}`}
                title={
                  unscheduled
                    ? "Partido sin día u horario asignado"
                    : undefined
                }
                className={cn(
                  "border-b border-dashed last:border-0",
                  unscheduled || schedule?.noRestGap
                    ? "bg-amber-200/70 dark:bg-amber-900/50"
                    : undefined,
                )}
              >
                <td className="py-1.5 pr-1.5 align-middle tabular-nums text-muted-foreground">
                  <div className="flex flex-col">
                    <span>{index + 1}</span>
                    {canReorder && onMove ? (
                      <span className="mt-0.5 flex flex-col">
                        <button
                          type="button"
                          className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => onMove(crossing.id, "up")}
                          aria-label={`Jugar antes el partido ${index + 1}`}
                          title="Jugar antes"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                          disabled={index === crossings.length - 1}
                          onClick={() => onMove(crossing.id, "down")}
                          aria-label={`Jugar después el partido ${index + 1}`}
                          title="Jugar después"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </span>
                    ) : null}
                    {unscheduled ? (
                      <span className="max-w-[4.5rem] text-[9px] font-medium leading-tight text-amber-900 dark:text-amber-100">
                        Sin horario
                      </span>
                    ) : schedule?.noRestGap ? (
                      <span className="max-w-[4.5rem] text-[9px] font-medium leading-tight text-amber-900 dark:text-amber-100">
                        Sin descanso
                      </span>
                    ) : null}
                    {showOfficialId ? (
                      <span className="max-w-[4.5rem] text-[9px] leading-tight text-muted-foreground/80">
                        n° {crossing.id}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="py-1.5 pr-1.5 align-middle">
                  <ScheduleSlotCell
                    value={
                      dayOptions.find((day) => day.value === schedule?.playDate)
                        ?.label ?? (schedule?.playDate || "—")
                    }
                    disabled={!canPickSlot || !onPickSchedule}
                    title={
                      canPickSlot
                        ? "Elegir día, horario y cancha en la regla de slots"
                        : undefined
                    }
                    ariaLabel={`Día partido ${index + 1}`}
                    onPick={() => onPickSchedule?.(crossing.id)}
                  />
                </td>
                <td className="py-1.5 pr-1.5 align-middle">
                  <ScheduleSlotCell
                    value={schedule?.startTime || "—"}
                    align="center"
                    disabled={!canPickSlot || !onPickSchedule}
                    title={
                      canPickSlot
                        ? "Elegir día, horario y cancha en la regla de slots"
                        : undefined
                    }
                    ariaLabel={`Horario partido ${index + 1}`}
                    onPick={() => onPickSchedule?.(crossing.id)}
                  />
                </td>
                <td className="py-1.5 pr-1.5 align-middle">
                  <ScheduleSlotCell
                    value={
                      schedule?.courtIndex == null
                        ? "—"
                        : String(schedule.courtIndex + 1)
                    }
                    align="center"
                    disabled={!canPickSlot || !onPickSchedule}
                    title={
                      canPickSlot
                        ? "Elegir día, horario y cancha en la regla de slots"
                        : undefined
                    }
                    ariaLabel={`Cancha partido ${index + 1}`}
                    onPick={() => onPickSchedule?.(crossing.id)}
                  />
                </td>
                <td className="min-w-0 py-1.5 pr-1.5 align-middle">
                  <CrossingPair
                    seed={crossing.left}
                    name={resolveLabel?.(crossing.left) ?? crossing.left}
                  />
                </td>
                <td className="min-w-0 py-1.5 pr-1.5 align-middle">
                  <CrossingPair
                    seed={crossing.right}
                    name={resolveLabel?.(crossing.right) ?? crossing.right}
                  />
                </td>
                <td className="py-1.5 align-middle">
                  <div className="flex justify-end gap-0.5">
                    {columns.map((col) => (
                      <button
                        key={col.key}
                        type="button"
                        className={cn(
                          SCORE_CLASS,
                          !scoreLocked && "cursor-pointer bg-background",
                        )}
                        disabled={scoreLocked}
                        onClick={() =>
                          setScorePicker({
                            officialId: crossing.id,
                            startKey: col.key,
                          })
                        }
                        aria-label={`${col.group ?? ""} ${col.label} partido ${index + 1}`}
                      >
                        {scoresByOfficialId?.get(crossing.id)?.[col.key] ||
                          "–"}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {scorePicker && pickerCrossing ? (
        <ScoreTapPicker
          open
          format={matchFormat}
          columns={columns}
          scores={scoresByOfficialId?.get(pickerCrossing.id) ?? {}}
          startKey={scorePicker.startKey}
          pair1Label={
            resolveLabel?.(pickerCrossing.left) ?? pickerCrossing.left
          }
          pair2Label={
            resolveLabel?.(pickerCrossing.right) ?? pickerCrossing.right
          }
          onChange={(key, value) =>
            onScoreChange?.(pickerCrossing.id, key, value)
          }
          onClose={() => setScorePicker(null)}
        />
      ) : null}
    </div>
  );
}

function CrossingPair({ seed, name }: { seed: string; name: string }) {
  const resolved = name !== seed;
  return (
    <div
      className="flex min-h-8 flex-col justify-center rounded-lg border border-input bg-background px-2 py-0.5"
      title={resolved ? `${name} · ${seed}` : seed}
    >
      <span className="text-xs font-medium leading-tight">{name}</span>
      {resolved ? (
        <span className="text-[10px] text-muted-foreground">{seed}</span>
      ) : null}
    </div>
  );
}
