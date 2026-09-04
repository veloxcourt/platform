import type { FapNode } from "@/modules/tournaments/domain/fap-llaves";
import type { FinalPhaseStartRound } from "@/modules/tournaments/domain/config-schema";
import { officialRoundPhase } from "@/modules/tournaments/domain/intermediate-phase";
import { formatWeekday } from "@/lib/date";
import { cn } from "@/lib/utils";

export type BracketMatchSchedule = {
  playDate: string | null;
  startTime: string | null;
  courtIndex: number | null;
};

export function formatBracketHorario(schedule?: BracketMatchSchedule): string {
  if (!schedule?.playDate || !schedule.startTime) return "Sin horario";
  const court =
    schedule.courtIndex == null ? "" : ` · C${schedule.courtIndex + 1}`;
  return `${formatWeekday(schedule.playDate)} ${schedule.startTime}${court}`;
}

export function bracketScheduleFromFixture(
  fixture:
    | {
        rounds: {
          matches: {
            officialId: number;
            playDate: string | null;
            startTime: string | null;
            courtIndex: number | null;
          }[];
        }[];
      }
    | null
    | undefined,
): Map<number, BracketMatchSchedule> {
  const map = new Map<number, BracketMatchSchedule>();
  for (const round of fixture?.rounds ?? []) {
    for (const match of round.matches) {
      map.set(match.officialId, {
        playDate: match.playDate,
        startTime: match.startTime,
        courtIndex: match.courtIndex,
      });
    }
  }
  return map;
}

const ROUND_FROM_ROOT = [
  "Final",
  "Semifinal",
  "Cuartos",
  "Octavos",
  "16 avos",
  "32 avos",
] as const;

function sideLabel(node: FapNode): string {
  if (node.kind === "bye") return "Bye";
  if (node.kind === "qualifier") return node.qualifier.label;
  return `Ganador n° ${node.id}`;
}

export function OfficialBracketDiagram({
  root,
  showOfficialId,
  startsAtRound,
  showPhaseLegend = false,
  scheduleByOfficialId,
}: {
  root: FapNode;
  showOfficialId: boolean;
  startsAtRound?: FinalPhaseStartRound;
  showPhaseLegend?: boolean;
  scheduleByOfficialId?: Map<number, BracketMatchSchedule>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {showPhaseLegend && startsAtRound ? (
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-amber-400 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40" />
            Fase intermedia
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-violet-400 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40" />
            Fase final
          </span>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-min px-1 py-2">
          <BracketBranch
            node={root}
            depth={0}
            showOfficialId={showOfficialId}
            startsAtRound={startsAtRound}
            scheduleByOfficialId={scheduleByOfficialId}
          />
        </div>
      </div>
    </div>
  );
}

function BracketBranch({
  node,
  depth,
  showOfficialId,
  startsAtRound,
  scheduleByOfficialId,
}: {
  node: FapNode;
  depth: number;
  showOfficialId: boolean;
  startsAtRound?: FinalPhaseStartRound;
  scheduleByOfficialId?: Map<number, BracketMatchSchedule>;
}) {
  if (node.kind !== "match") {
    return <LeafBox label={sideLabel(node)} bye={node.kind === "bye"} />;
  }

  const label = ROUND_FROM_ROOT[depth] ?? "Ronda";
  const phase = startsAtRound
    ? officialRoundPhase(label, startsAtRound)
    : null;

  return (
    <div className="flex items-center">
      <div className="flex flex-col justify-center">
        <BracketBranch
          node={node.left}
          depth={depth + 1}
          showOfficialId={showOfficialId}
          startsAtRound={startsAtRound}
          scheduleByOfficialId={scheduleByOfficialId}
        />
        <BracketBranch
          node={node.right}
          depth={depth + 1}
          showOfficialId={showOfficialId}
          startsAtRound={startsAtRound}
          scheduleByOfficialId={scheduleByOfficialId}
        />
      </div>
      <div className="flex w-5 self-stretch py-[1.35rem]">
        <div className="h-full w-full rounded-r-sm border-y border-r border-border" />
      </div>
      <MatchBox
        label={label}
        officialId={node.id}
        showOfficialId={showOfficialId}
        phase={phase}
        schedule={scheduleByOfficialId?.get(node.id)}
      />
    </div>
  );
}

function LeafBox({ label, bye }: { label: string; bye: boolean }) {
  return (
    <div
      className={cn(
        "m-1 flex h-8 min-w-[5.5rem] items-center rounded-md border px-2 text-xs",
        bye
          ? "border-dashed text-muted-foreground"
          : "border-input bg-background font-medium",
      )}
    >
      {label}
    </div>
  );
}

function MatchBox({
  label,
  officialId,
  showOfficialId,
  phase,
  schedule,
}: {
  label: string;
  officialId: number;
  showOfficialId: boolean;
  phase?: "intermediate" | "final" | null;
  schedule?: BracketMatchSchedule;
}) {
  const horario = formatBracketHorario(schedule);
  const unscheduled = horario === "Sin horario";

  return (
    <div
      className={cn(
        "m-1 flex min-h-8 min-w-[7.25rem] flex-col justify-center rounded-md border px-2 py-1",
        phase === "intermediate" &&
          "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
        phase === "final" &&
          "border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
        !phase &&
          "border-teal-200/80 bg-teal-50/80 dark:border-teal-900 dark:bg-teal-950/30",
      )}
    >
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">
        {showOfficialId ? `n° ${officialId}` : "Ganador"}
      </p>
      <p
        className={cn(
          "text-[10px] leading-tight",
          unscheduled ? "text-muted-foreground/80" : "font-medium",
        )}
      >
        {horario}
      </p>
    </div>
  );
}
