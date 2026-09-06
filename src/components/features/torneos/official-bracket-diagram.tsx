"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

type Slot = "left" | "right";

export function bracketSideLabel(node: FapNode): string {
  if (node.kind === "bye") return "Bye";
  if (node.kind === "qualifier") return node.qualifier.label;
  return `Ganador n° ${node.id}`;
}

function resolveBracketLabel(
  label: string,
  resolveLabel?: (label: string) => string,
): string {
  return resolveLabel?.(label) ?? label;
}

export function resolvedBracketSideLabel(
  node: FapNode,
  resolveLabel?: (label: string) => string,
): string {
  return resolveBracketLabel(bracketSideLabel(node), resolveLabel);
}

export function resolvedMatchWinnerLabel(
  officialId: number,
  resolveLabel?: (label: string) => string,
): string | undefined {
  const raw = `Ganador n° ${officialId}`;
  const resolved = resolveBracketLabel(raw, resolveLabel);
  return resolved !== raw ? resolved : undefined;
}

export function OfficialBracketDiagram({
  root,
  showOfficialId,
  startsAtRound,
  showPhaseLegend = false,
  scheduleByOfficialId,
  resolveLabel,
}: {
  root: FapNode;
  showOfficialId: boolean;
  startsAtRound?: FinalPhaseStartRound;
  showPhaseLegend?: boolean;
  scheduleByOfficialId?: Map<number, BracketMatchSchedule>;
  resolveLabel?: (label: string) => string;
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
            resolveLabel={resolveLabel}
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
  resolveLabel,
}: {
  node: FapNode;
  depth: number;
  showOfficialId: boolean;
  startsAtRound?: FinalPhaseStartRound;
  scheduleByOfficialId?: Map<number, BracketMatchSchedule>;
  resolveLabel?: (label: string) => string;
}) {
  if (node.kind !== "match") {
    const seed = bracketSideLabel(node);
    const name = resolveLabel?.(seed) ?? seed;
    return (
      <PairCard
        name={name}
        seed={name !== seed ? seed : undefined}
        bye={node.kind === "bye"}
      />
    );
  }

  const label = ROUND_FROM_ROOT[depth] ?? "Ronda";
  const phase = startsAtRound
    ? officialRoundPhase(label, startsAtRound)
    : null;
  const leftIsMatch = node.left.kind === "match";
  const rightIsMatch = node.right.kind === "match";
  const compact = !leftIsMatch && !rightIsMatch;
  const winnerName = resolvedMatchWinnerLabel(node.id, resolveLabel);
  const leftSeed = bracketSideLabel(node.left);
  const rightSeed = bracketSideLabel(node.right);
  const leftName = resolveBracketLabel(leftSeed, resolveLabel);
  const rightName = resolveBracketLabel(rightSeed, resolveLabel);

  const destSlots =
    leftIsMatch && rightIsMatch
      ? "both"
      : leftIsMatch
        ? "left"
        : rightIsMatch
          ? "right"
          : undefined;

  const matchUnit = (
    <MatchUnit
      label={label}
      officialId={node.id}
      showOfficialId={showOfficialId}
      phase={phase}
      schedule={scheduleByOfficialId?.get(node.id)}
      leftName={leftName}
      leftSeed={leftName !== leftSeed ? leftSeed : undefined}
      leftBye={node.left.kind === "bye"}
      rightName={rightName}
      rightSeed={rightName !== rightSeed ? rightSeed : undefined}
      rightBye={node.right.kind === "bye"}
      winnerName={winnerName}
      destSlots={destSlots}
    />
  );

  if (compact) return matchUnit;

  const branchProps = {
    depth: depth + 1,
    showOfficialId,
    startsAtRound,
    scheduleByOfficialId,
    resolveLabel,
  };

  if (!(leftIsMatch && rightIsMatch)) {
    const child = leftIsMatch ? node.left : node.right;
    const dest = leftIsMatch ? "left" : "right";
    return (
      <JoinToNames feeds={[{ side: dest, child: <BracketBranch node={child} {...branchProps} /> }]}>
        {matchUnit}
      </JoinToNames>
    );
  }

  return (
    <JoinToNames
      feeds={[
        { side: "left", child: <BracketBranch node={node.left} {...branchProps} /> },
        { side: "right", child: <BracketBranch node={node.right} {...branchProps} /> },
      ]}
    >
      {matchUnit}
    </JoinToNames>
  );
}

function JoinToNames({
  feeds,
  children,
}: {
  feeds: { side: Slot; child: ReactNode }[];
  children: ReactNode;
}) {
  const joinId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function measure() {
      if (!wrap) return;
      const box = wrap.getBoundingClientRect();
      const next: string[] = [];
      for (const side of ["left", "right"] as const) {
        const source = wrap.querySelector<HTMLElement>(
          `[data-join-source="${joinId}"][data-join-side="${side}"]`,
        );
        const dest = wrap.querySelector<HTMLElement>(
          `[data-join-match="${joinId}"] [data-feed-dest="${side}"]`,
        );
        if (!source || !dest) continue;
        const s = source.getBoundingClientRect();
        const d = dest.getBoundingClientRect();
        const x1 = s.right - box.left;
        const y1 = s.top + s.height / 2 - box.top;
        const x2 = d.left - box.left;
        const y2 = d.top + d.height / 2 - box.top;
        const midX = x1 + Math.max(10, (x2 - x1) / 2);
        next.push(`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`);
      }
      setPaths((prev) =>
        prev.length === next.length && prev.every((path, i) => path === next[i])
          ? prev
          : next,
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [joinId]);

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <div
        className={cn(
          "flex",
          feeds.length > 1 ? "flex-col justify-around gap-6" : "items-center",
        )}
      >
        {feeds.map((feed) => (
          <div
            key={feed.side}
            data-join-source={joinId}
            data-join-side={feed.side}
          >
            {feed.child}
          </div>
        ))}
      </div>
      <div className="w-6 shrink-0" aria-hidden />
      <div data-join-match={joinId}>{children}</div>
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible text-border"
        width="100%"
        height="100%"
        aria-hidden
      >
        {paths.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}

function MatchUnit({
  label,
  officialId,
  showOfficialId,
  phase,
  schedule,
  leftName,
  leftSeed,
  leftBye,
  rightName,
  rightSeed,
  rightBye,
  winnerName,
  destSlots,
}: {
  label: string;
  officialId: number;
  showOfficialId: boolean;
  phase?: "intermediate" | "final" | null;
  schedule?: BracketMatchSchedule;
  leftName: string;
  leftSeed?: string;
  leftBye: boolean;
  rightName: string;
  rightSeed?: string;
  rightBye: boolean;
  winnerName?: string;
  destSlots?: Slot | "both";
}) {
  return (
    <div className="m-1 flex w-[11.5rem] flex-col gap-1">
      <PairCard
        name={leftName}
        seed={leftSeed}
        bye={leftBye}
        winner={winnerName === leftName}
        feedDest={destSlots === "left" || destSlots === "both" ? "left" : undefined}
      />
      <MatchMeta
        label={label}
        officialId={officialId}
        showOfficialId={showOfficialId}
        phase={phase}
        schedule={schedule}
      />
      <PairCard
        name={rightName}
        seed={rightSeed}
        bye={rightBye}
        winner={winnerName === rightName}
        feedDest={destSlots === "right" || destSlots === "both" ? "right" : undefined}
      />
    </div>
  );
}

function PairCard({
  name,
  seed,
  bye,
  winner = false,
  feedDest,
}: {
  name: string;
  seed?: string;
  bye: boolean;
  winner?: boolean;
  feedDest?: Slot;
}) {
  const placeholder = /^ganador\s*n[°º.]?\s*\d+$/i.test(name.trim());
  return (
    <div
      data-feed-dest={feedDest}
      className={cn(
        "flex min-h-8 w-full flex-col items-center justify-center rounded-md border px-2 py-1 text-center text-xs shadow-sm",
        bye
          ? "border-dashed bg-background text-muted-foreground"
          : "border-input bg-background",
        winner && "border-foreground/40 font-semibold",
        !winner && !bye && "font-medium",
      )}
      title={seed ? `${name} · ${seed}` : name}
    >
      <span
        className={cn(
          "w-full text-center leading-tight",
          placeholder && "text-muted-foreground",
        )}
      >
        {name}
      </span>
      {seed ? (
        <span className="w-full text-center text-[10px] font-normal text-muted-foreground">
          {seed}
        </span>
      ) : null}
    </div>
  );
}

function MatchMeta({
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
        "relative flex min-h-11 w-full flex-col items-center justify-center rounded-md border px-2 py-1.5 text-center shadow-sm",
        phase === "intermediate" &&
          "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
        phase === "final" &&
          "border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
        !phase &&
          "border-teal-200/80 bg-teal-50/80 dark:border-teal-900 dark:bg-teal-950/30",
      )}
    >
      {showOfficialId ? (
        <span className="absolute top-1 right-1.5 text-[10px] font-medium">
          n° {officialId}
        </span>
      ) : null}
      <p className="text-[11px] font-medium leading-tight">{label}</p>
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
