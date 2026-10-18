"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  CircleAlert,
  Clock,
  GripVertical,
  Inbox,
  Lock,
  Save,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatWeekday } from "@/lib/date";
import { cn } from "@/lib/utils";
import { saveZonesArmadoProAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import {
  armadoProIssues,
  armadoProLayoutFromBoard,
  armadoProLetterOptions,
  armadoProZoneLabel,
  buildArmadoProBoard,
  moveArmadoProPair,
  moveArmadoProZone,
  setArmadoProZoneLetter,
  type ArmadoProBoard,
  type ArmadoProSource,
  type ArmadoProTarget,
  type ArmadoProZone,
} from "@/modules/tournaments/domain/armado-pro";
import {
  groupPairsByPreference,
  pairHasPreferences,
  pairsShareTime,
  preferenceCellsByPair,
  zoneTimeCheck,
  type PreferenceCell,
  type ZoneTimeCheck,
} from "@/modules/tournaments/domain/armado-pro-time";
import type { ZonesDayPreference } from "@/modules/tournaments/domain/zones-day-preference";

type DragData =
  | { kind: "pair"; source: ArmadoProSource; pairId: string }
  | { kind: "zone"; zoneKey: string };

type DropData =
  | { kind: "target"; target: ArmadoProTarget; rank: number }
  | { kind: "zone"; zoneKey: string };

const NO_SELECT_STYLE = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
} as const;

/// Sin ámbar ni rojo: esos colores ya marcan zonas incompletas y errores.
const TIME_GROUP_TONES = [
  {
    chip: "border-sky-400 bg-sky-100 text-sky-950 dark:border-sky-500/70 dark:bg-sky-950/50 dark:text-sky-100",
    dot: "bg-sky-500",
  },
  {
    chip: "border-emerald-400 bg-emerald-100 text-emerald-950 dark:border-emerald-500/70 dark:bg-emerald-950/50 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  {
    chip: "border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-500/70 dark:bg-violet-950/50 dark:text-violet-100",
    dot: "bg-violet-500",
  },
  {
    chip: "border-orange-400 bg-orange-100 text-orange-950 dark:border-orange-500/70 dark:bg-orange-950/50 dark:text-orange-100",
    dot: "bg-orange-500",
  },
  {
    chip: "border-pink-400 bg-pink-100 text-pink-950 dark:border-pink-500/70 dark:bg-pink-950/50 dark:text-pink-100",
    dot: "bg-pink-500",
  },
  {
    chip: "border-lime-500 bg-lime-100 text-lime-950 dark:border-lime-500/70 dark:bg-lime-950/50 dark:text-lime-100",
    dot: "bg-lime-500",
  },
  {
    chip: "border-cyan-400 bg-cyan-100 text-cyan-950 dark:border-cyan-500/70 dark:bg-cyan-950/50 dark:text-cyan-100",
    dot: "bg-cyan-500",
  },
  {
    chip: "border-fuchsia-400 bg-fuchsia-100 text-fuchsia-950 dark:border-fuchsia-500/70 dark:bg-fuchsia-950/50 dark:text-fuchsia-100",
    dot: "bg-fuchsia-500",
  },
  {
    chip: "border-teal-400 bg-teal-100 text-teal-950 dark:border-teal-500/70 dark:bg-teal-950/50 dark:text-teal-100",
    dot: "bg-teal-500",
  },
  {
    chip: "border-indigo-400 bg-indigo-100 text-indigo-950 dark:border-indigo-500/70 dark:bg-indigo-950/50 dark:text-indigo-100",
    dot: "bg-indigo-500",
  },
] as const;

const FLEXIBLE_TONE = "border-dashed border-muted-foreground/50";
const OTHER_TIMES_TONE = "border-border bg-muted";

type TimeLegendItem = {
  key: string;
  label: string;
  count: number;
  tone: string;
  dot?: string;
};

/// `null` con los colores por horario apagados.
type PairTimeStyle = { tone: string | null; dimmed: boolean } | null;

/// Ej. "sáb 17 14:00–17:00 · dom 18 10:00–11:30".
function describeCells(cells: PreferenceCell[]): string {
  const ranges: Array<{
    date: string;
    start: string;
    end: string;
    lastIndex: number;
  }> = [];
  for (const cell of cells) {
    const last = ranges[ranges.length - 1];
    if (
      last &&
      last.date === cell.playDate &&
      cell.slotIndex === last.lastIndex + 1
    ) {
      last.end = cell.endTime;
      last.lastIndex = cell.slotIndex;
    } else {
      ranges.push({
        date: cell.playDate,
        start: cell.startTime,
        end: cell.endTime,
        lastIndex: cell.slotIndex,
      });
    }
  }
  const parts = ranges.map(
    (range) => `${formatWeekday(range.date)} ${range.start}–${range.end}`,
  );
  return parts.length > 2
    ? `${parts.slice(0, 2).join(" · ")} …`
    : parts.join(" · ");
}

/// Casillas antes que la zona entera; la zona antes que el auxiliar.
const collisionDetection: CollisionDetection = (args) => {
  const activeKind = (args.active.data.current as DragData | undefined)?.kind;
  const kindOf = (data: unknown) => (data as DropData | undefined)?.kind;
  if (activeKind === "zone") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => kindOf(container.data.current) === "zone",
      ),
    });
  }
  const targets = args.droppableContainers.filter(
    (container) => kindOf(container.data.current) === "target",
  );
  const scoped = { ...args, droppableContainers: targets };
  const hits = pointerWithin(scoped);
  const found = hits.length > 0 ? hits : rectIntersection(scoped);
  const rankOf = (id: string | number) => {
    const data = targets.find((container) => container.id === id)?.data
      .current as DropData | undefined;
    return data?.kind === "target" ? data.rank : 9;
  };
  return [...found].sort((left, right) => rankOf(left.id) - rankOf(right.id));
};

function sameSource(left: ArmadoProSource, right: ArmadoProSource): boolean {
  if (left.kind === "aux" && right.kind === "aux") {
    return left.pairId === right.pairId;
  }
  if (left.kind === "slot" && right.kind === "slot") {
    return left.zoneKey === right.zoneKey && left.index === right.index;
  }
  return false;
}

function pairIdAt(board: ArmadoProBoard, source: ArmadoProSource) {
  if (source.kind === "aux") return source.pairId;
  return (
    board.zones.find((zone) => zone.key === source.zoneKey)?.slots[
      source.index
    ] ?? null
  );
}

/// Comparación sin el orden del auxiliar (no se guarda como dato útil).
function boardKey(board: ArmadoProBoard): string {
  const layout = armadoProLayoutFromBoard(board);
  return JSON.stringify({
    zones: layout.zones,
    aux: [...layout.unassignedPairIds].sort(),
  });
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarizeChanges(
  initial: ArmadoProBoard,
  current: ArmadoProBoard,
  labelOf: (id: string) => string,
): string[] {
  const lines: string[] = [];
  const initialByKey = new Map(initial.zones.map((zone) => [zone.key, zone]));
  for (const zone of current.zones) {
    const before = initialByKey.get(zone.key);
    const beforeIds = (before?.slots ?? []).filter(
      (id): id is string => Boolean(id),
    );
    const nowIds = zone.slots.filter((id): id is string => Boolean(id));
    const entered = nowIds.filter((id) => !beforeIds.includes(id));
    const left = beforeIds.filter((id) => !nowIds.includes(id));
    const parts: string[] = [];
    if (before && before.letter !== zone.letter) {
      parts.push(`antes era ${before.letter}`);
    }
    if (entered.length > 0) {
      parts.push(`entra ${entered.map(labelOf).join(", ")}`);
    }
    if (left.length > 0) parts.push(`sale ${left.map(labelOf).join(", ")}`);
    if (
      entered.length === 0 &&
      left.length === 0 &&
      beforeIds.join("|") !== nowIds.join("|")
    ) {
      parts.push("cambia el orden (1.ª ronda)");
    }
    if (parts.length > 0) {
      lines.push(`${armadoProZoneLabel(zone.letter)}: ${parts.join(" · ")}`);
    }
  }
  return lines;
}

export type ArmadoProPair = {
  id: string;
  label: string;
  zonesDayPreference?: ZonesDayPreference;
};

export type ArmadoProBoardProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (result: { switchedToManual: boolean }) => void;
  clubSlug: string;
  tournamentId: string;
  categoryId: string;
  categoryName: string;
  isManual: boolean;
  pairsPerZone: number;
  zones: Array<{
    label: string;
    pairIds: string[];
    matches: Array<{ scores?: unknown }>;
  }>;
  /// Parejas Parcial o Confirmado de la categoría, en orden de inscripción.
  eligiblePairs: ArmadoProPair[];
  /// Todas las parejas de la categoría (para nombrar las de zonas con resultados).
  allPairs: ArmadoProPair[];
  /// Franjas preferidas de la fase de zonas, solo de esta categoría.
  preferences: Array<{
    pairId: string;
    playDate: string;
    slotIndex: number;
    startTime: string;
    endTime: string;
  }>;
};

/// Pantalla completa. Se cierra solo con Volver o Escape (que piden
/// confirmación si hay cambios sin guardar).
export function ArmadoProBoardDialog(props: ArmadoProBoardProps) {
  return (
    <DialogPrimitive.Root open={props.open} disablePointerDismissal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup className="fixed inset-0 z-[100] flex h-dvh flex-col bg-background text-foreground outline-none">
          <DialogPrimitive.Title className="sr-only">
            Armado Pro · {props.categoryName}
          </DialogPrimitive.Title>
          <ArmadoProWorkspace {...props} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ArmadoProWorkspace({
  onClose,
  onSaved,
  clubSlug,
  tournamentId,
  categoryId,
  categoryName,
  isManual,
  pairsPerZone,
  zones: sourceZones,
  eligiblePairs,
  allPairs,
  preferences,
}: ArmadoProBoardProps) {
  const [initialBoard] = useState(() =>
    buildArmadoProBoard({
      zones: sourceZones,
      eligiblePairIds: eligiblePairs.map((pair) => pair.id),
      pairsPerZone,
    }),
  );
  const [board, setBoard] = useState(initialBoard);
  const [history, setHistory] = useState<ArmadoProBoard[]>([]);
  const [selected, setSelected] = useState<ArmadoProSource | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [confirm, setConfirm] = useState<"save" | "discard" | null>(null);
  const [isSaving, startSaving] = useTransition();
  const suppressClickRef = useRef(false);

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const pair of allPairs) map.set(pair.id, pair.label);
    for (const pair of eligiblePairs) map.set(pair.id, pair.label);
    return map;
  }, [allPairs, eligiblePairs]);
  const labelOf = (id: string) => labelById.get(id) ?? "Pareja no disponible";

  const issues = useMemo(() => armadoProIssues(board), [board]);
  const letterOptions = useMemo(
    () => armadoProLetterOptions(board.zones.length),
    [board.zones.length],
  );
  const dirty = useMemo(
    () => boardKey(board) !== boardKey(initialBoard),
    [board, initialBoard],
  );
  const totalPairs = useMemo(
    () =>
      board.zones.reduce(
        (sum, zone) => sum + zone.slots.filter(Boolean).length,
        0,
      ) + board.aux.length,
    [board],
  );
  const placedPairs = totalPairs - board.aux.length;
  const selectedPairId = selected ? pairIdAt(board, selected) : null;

  const [showTimeColors, setShowTimeColors] = useState(false);
  const preferenceCells = useMemo(
    () => preferenceCellsByPair(preferences),
    [preferences],
  );
  const dayPreferenceByPair = useMemo(
    () =>
      new Map(
        eligiblePairs.flatMap((pair) =>
          pair.zonesDayPreference
            ? [[pair.id, pair.zonesDayPreference] as const]
            : [],
        ),
      ),
    [eligiblePairs],
  );
  // Las parejas del tablero no cambian al moverlas: colores estables.
  const timeColors = useMemo(() => {
    const pairIds = [
      ...initialBoard.zones.flatMap((zone) =>
        zone.slots.filter((id): id is string => id !== null),
      ),
      ...initialBoard.aux,
    ];
    const toneByPair = new Map<string, string>();
    const legend: TimeLegendItem[] = [];
    let otherCount = 0;
    for (const group of groupPairsByPreference(pairIds, preferenceCells)) {
      const tone =
        group.pairIds.length > 1 ? TIME_GROUP_TONES[legend.length] : undefined;
      for (const id of group.pairIds) {
        toneByPair.set(id, tone?.chip ?? OTHER_TIMES_TONE);
      }
      if (!tone) {
        otherCount += group.pairIds.length;
        continue;
      }
      legend.push({
        key: `group-${legend.length}`,
        label: describeCells(group.cells),
        count: group.pairIds.length,
        tone: tone.chip,
        dot: tone.dot,
      });
    }
    const flexible = pairIds.filter(
      (id) => !pairHasPreferences(preferenceCells, id),
    );
    for (const id of flexible) toneByPair.set(id, FLEXIBLE_TONE);
    if (otherCount > 0) {
      legend.push({
        key: "other",
        label: "Otros horarios",
        count: otherCount,
        tone: OTHER_TIMES_TONE,
      });
    }
    if (flexible.length > 0 && flexible.length < pairIds.length) {
      legend.push({
        key: "flexible",
        label: "Sin preferencia",
        count: flexible.length,
        tone: FLEXIBLE_TONE,
      });
    }
    return { toneByPair, legend, anyPreference: flexible.length < pairIds.length };
  }, [initialBoard, preferenceCells]);
  const zoneTimeChecks = useMemo(
    () =>
      showTimeColors
        ? new Map(
            board.zones.map((zone) => [
              zone.key,
              zoneTimeCheck(zone.slots, preferenceCells, dayPreferenceByPair),
            ]),
          )
        : null,
    [board, showTimeColors, preferenceCells, dayPreferenceByPair],
  );
  const focusPairId =
    selectedPairId ?? (activeDrag?.kind === "pair" ? activeDrag.pairId : null);

  function pairTimeStyle(pairId: string): PairTimeStyle {
    if (!showTimeColors) return null;
    return {
      tone: timeColors.toneByPair.get(pairId) ?? null,
      dimmed: Boolean(
        focusPairId &&
          focusPairId !== pairId &&
          !pairsShareTime(preferenceCells, focusPairId, pairId),
      ),
    };
  }

  function handleBack() {
    if (isSaving) return;
    if (confirm) {
      setConfirm(null);
      return;
    }
    if (dirty) setConfirm("discard");
    else onClose();
  }

  const onEscape = useEffectEvent(() => {
    if (!activeDrag) handleBack();
  });
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function commit(next: ArmadoProBoard) {
    setHistory((previous) => [...previous.slice(-49), board]);
    setBoard(next);
    setSelected(null);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setBoard(previous);
    setSelected(null);
  }

  function applyMove(source: ArmadoProSource, target: ArmadoProTarget) {
    const result = moveArmadoProPair(board, source, target);
    if (!result.ok) {
      toast.error(result.error);
      setSelected(null);
      return;
    }
    if (result.board === board) {
      setSelected(null);
      return;
    }
    commit(result.board);
    if (result.displacedPairId) {
      toast.message(`${labelOf(result.displacedPairId)} pasó al auxiliar`, {
        duration: 2500,
      });
    }
  }

  function zoneIsLocked(source: ArmadoProSource) {
    if (source.kind !== "slot") return false;
    return Boolean(
      board.zones.find((zone) => zone.key === source.zoneKey)?.locked,
    );
  }

  function handlePairTap(source: ArmadoProSource) {
    if (suppressClickRef.current) return;
    if (!selected) {
      if (zoneIsLocked(source)) {
        toast.error("Esta zona tiene resultados cargados: no se pueden mover sus parejas.");
        return;
      }
      setSelected(source);
      return;
    }
    if (sameSource(selected, source)) {
      setSelected(null);
      return;
    }
    if (source.kind === "aux") {
      if (selected.kind === "aux") setSelected(source);
      else applyMove(selected, { kind: "aux" });
      return;
    }
    applyMove(selected, {
      kind: "slot",
      zoneKey: source.zoneKey,
      index: source.index,
    });
  }

  function handleEmptySlotTap(zoneKey: string, index: number) {
    if (suppressClickRef.current || !selected) return;
    applyMove(selected, { kind: "slot", zoneKey, index });
  }

  function handleAuxTap() {
    if (suppressClickRef.current || selected?.kind !== "slot") return;
    applyMove(selected, { kind: "aux" });
  }

  function releaseClickSuppression() {
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 120);
  }

  function handleDragStart(event: DragStartEvent) {
    suppressClickRef.current = true;
    setSelected(null);
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    releaseClickSuppression();
    const data = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    if (!data || !over) return;
    if (data.kind === "zone") {
      if (over.kind === "zone" && over.zoneKey !== data.zoneKey) {
        commit(moveArmadoProZone(board, data.zoneKey, over.zoneKey));
      }
      return;
    }
    if (over.kind === "target") applyMove(data.source, over.target);
  }

  function handleDragCancel() {
    setActiveDrag(null);
    releaseClickSuppression();
  }

  function handleSaveRequest() {
    const firstError = [...issues.letterErrors.values()][0];
    if (firstError) {
      toast.error("Corregí las letras marcadas en rojo", {
        description: firstError,
      });
      return;
    }
    setSelected(null);
    setConfirm("save");
  }

  function save() {
    startSaving(async () => {
      const result = await saveZonesArmadoProAction(
        clubSlug,
        tournamentId,
        categoryId,
        armadoProLayoutFromBoard(board),
      );
      if (!result.ok) {
        setConfirm(null);
        toast.error("No se pudo guardar el Armado Pro", {
          description: result.error,
        });
        return;
      }
      toast.success(`Zonas guardadas · ${categoryName}`, {
        description: [
          result.unscheduledMatchCount > 0
            ? `${pluralize(result.unscheduledMatchCount, "partido", "partidos")} sin día, horario ni cancha`
            : null,
          result.unassignedCount > 0
            ? `${pluralize(result.unassignedCount, "pareja", "parejas")} sin zona`
            : null,
          result.switchedToManual ? "Zonas pasó a Modo Manual" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      onSaved({ switchedToManual: result.switchedToManual });
    });
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );

  const zoneIds = board.zones.map((zone) => `zone|${zone.key}`);
  const activeDragZone =
    activeDrag?.kind === "zone"
      ? board.zones.find((zone) => zone.key === activeDrag.zoneKey)
      : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Presioná Enter para elegir la pareja y después elegí el destino.",
        },
      }}
    >
      <header className="flex shrink-0 items-center gap-1.5 border-b px-2 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={isSaving}
          aria-label="Volver"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Volver</span>
        </Button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">
            Armado Pro · {categoryName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {placedPairs} de {totalPairs} parejas en zonas
            {board.aux.length > 0 ? ` · ${board.aux.length} en auxiliar` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={undo}
          disabled={history.length === 0 || isSaving}
          aria-label="Deshacer"
          title="Deshacer"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSaveRequest}
          disabled={!dirty || isSaving}
        >
          <Save className="size-4" />
          Guardar
        </Button>
      </header>

      <TimeColorsBar
        checked={showTimeColors}
        onCheckedChange={setShowTimeColors}
        legend={timeColors.legend}
        anyPreference={timeColors.anyPreference}
      />

      {selectedPairId ? (
        <div className="flex shrink-0 items-center gap-2 bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <span className="min-w-0 flex-1 truncate">
            Mover {labelOf(selectedPairId)}: tocá un lugar, otra pareja o el
            auxiliar.
            {showTimeColors && timeColors.anyPreference
              ? " Las atenuadas no comparten horario con ella."
              : ""}
          </span>
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-0.5 font-medium underline underline-offset-2"
            onClick={() => setSelected(null)}
          >
            Cancelar
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3">
          {board.zones.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay parejas Parcial o Confirmado para armar zonas.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Arrastrá una pareja (en celular, mantenela apretada) o tocala y
                después tocá el destino. Si la soltás sobre otra pareja, la de
                abajo va al auxiliar.
              </p>
              <SortableContext items={zoneIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {board.zones.map((zone) => (
                    <ZoneBox
                      key={zone.key}
                      zone={zone}
                      letterOptions={letterOptions}
                      letterError={issues.letterErrors.get(zone.key)}
                      incomplete={issues.incompleteZoneKeys.has(zone.key)}
                      timeCheck={zoneTimeChecks?.get(zone.key) ?? null}
                      labelOf={labelOf}
                      pairTimeStyle={pairTimeStyle}
                      selected={selected}
                      activeDrag={activeDrag}
                      onPairTap={handlePairTap}
                      onEmptySlotTap={handleEmptySlotTap}
                      onLetterChange={(letter) =>
                        commit(setArmadoProZoneLetter(board, zone.key, letter))
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </>
          )}
        </main>

        <AuxPanel
          aux={board.aux}
          labelOf={labelOf}
          pairTimeStyle={pairTimeStyle}
          selected={selected}
          activeDrag={activeDrag}
          onPairTap={handlePairTap}
          onTap={handleAuxTap}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag?.kind === "pair" ? (
          <div
            className={cn(
              "max-w-56 rounded-lg border bg-background px-2 py-1.5 text-xs leading-tight shadow-lg",
              pairTimeStyle(activeDrag.pairId)?.tone,
              "border-primary",
            )}
          >
            {labelOf(activeDrag.pairId)}
          </div>
        ) : activeDragZone ? (
          <div className="w-44 rounded-xl border bg-card p-2 text-xs shadow-lg">
            <p className="font-medium">{armadoProZoneLabel(activeDragZone.letter)}</p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {activeDragZone.slots.map((id, index) => (
                <li key={index} className="truncate">
                  {id ? labelOf(id) : "—"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DragOverlay>

      {confirm ? (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-xl ring-1 ring-foreground/10 sm:rounded-2xl">
            {confirm === "discard" ? (
              <>
                <h2 className="text-base font-medium">¿Salir sin guardar?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se pierden los cambios que hiciste en el Armado Pro.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirm(null)}
                  >
                    Seguir editando
                  </Button>
                  <Button type="button" variant="destructive" onClick={onClose}>
                    Salir sin guardar
                  </Button>
                </div>
              </>
            ) : (
              <SaveSummary
                initialBoard={initialBoard}
                board={board}
                incompleteZoneKeys={issues.incompleteZoneKeys}
                isManual={isManual}
                labelOf={labelOf}
                isSaving={isSaving}
                onCancel={() => setConfirm(null)}
                onConfirm={save}
              />
            )}
          </div>
        </div>
      ) : null}
    </DndContext>
  );
}

function SaveSummary({
  initialBoard,
  board,
  incompleteZoneKeys,
  isManual,
  labelOf,
  isSaving,
  onCancel,
  onConfirm,
}: {
  initialBoard: ArmadoProBoard;
  board: ArmadoProBoard;
  incompleteZoneKeys: Set<string>;
  isManual: boolean;
  labelOf: (id: string) => string;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const changes = summarizeChanges(initialBoard, board, labelOf);
  const incomplete = board.zones.filter(
    (zone) =>
      incompleteZoneKeys.has(zone.key) && zone.slots.some((id) => id !== null),
  );
  const empty = board.zones.filter((zone) =>
    zone.slots.every((id) => id === null),
  );
  const notes = [
    changes.length > 0
      ? "En las zonas que cambian, los partidos nuevos quedan sin día, horario ni cancha. Los cruces que siguen igual conservan su horario."
      : null,
    incomplete.length > 0
      ? `Incompletas: ${incomplete
          .map(
            (zone) =>
              `${armadoProZoneLabel(zone.letter)} (${zone.slots.filter(Boolean).length} de ${zone.slots.length})`,
          )
          .join(", ")}.`
      : null,
    empty.length > 0
      ? `${empty.map((zone) => armadoProZoneLabel(zone.letter)).join(", ")} ${empty.length === 1 ? "está vacía y no se guarda" : "están vacías y no se guardan"}.`
      : null,
    board.aux.length > 0
      ? `${pluralize(board.aux.length, "pareja queda", "parejas quedan")} sin zona (en el auxiliar).`
      : null,
    isManual
      ? null
      : "Zonas de esta categoría pasa a Modo Manual, así Actualizar no rearma lo que armaste.",
  ].filter((note): note is string => Boolean(note));

  return (
    <>
      <h2 className="text-base font-medium">Guardar el Armado Pro</h2>
      <div className="mt-2 max-h-[45vh] space-y-3 overflow-y-auto text-sm">
        {changes.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-foreground">
            {changes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Cambió solo la ubicación de las zonas en el tablero.
          </p>
        )}
        {notes.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Seguir editando
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isSaving}>
          <Save className="size-4" />
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </>
  );
}

function TimeColorsBar({
  checked,
  onCheckedChange,
  legend,
  anyPreference,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  legend: TimeLegendItem[];
  anyPreference: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-1.5 text-[11px] [scrollbar-width:thin]">
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 font-medium">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        Colores por horario
      </label>
      {!checked ? (
        <span className="shrink-0 text-muted-foreground">
          Mismo color = comparten una franja preferida y pueden jugar entre sí.
        </span>
      ) : !anyPreference ? (
        <span className="shrink-0 text-muted-foreground">
          Ninguna pareja de esta categoría cargó preferencias horarias.
        </span>
      ) : (
        legend.map((item) => (
          <span
            key={item.key}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 whitespace-nowrap",
              item.tone,
            )}
          >
            {item.dot ? (
              <span className={cn("size-2 rounded-full", item.dot)} />
            ) : null}
            {item.label}
            <span className="opacity-70">· {item.count}</span>
          </span>
        ))
      )}
    </div>
  );
}

function ZoneTimeVerdict({ check }: { check: ZoneTimeCheck }) {
  if (check.kind === "incomplete") return null;
  if (check.kind === "ok") {
    return (
      <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
        <Clock className="size-3 shrink-0" />
        Horarios compatibles
      </p>
    );
  }
  const text =
    check.kind === "missing"
      ? `Sin horario en común: ${check.pairings
          .map(([left, right]) => `${left + 1} vs ${right + 1}`)
          .join(" · ")}`
      : "No alcanzan los horarios para los 3 partidos";
  return (
    <p
      className="flex items-start gap-1 text-[10px] font-medium text-rose-700 dark:text-rose-300"
      title={
        check.kind === "crowded"
          ? "Comparten franjas de a dos, pero no hay 3 que respeten el descanso entre partidos y la preferencia de día de cada pareja."
          : undefined
      }
    >
      <CircleAlert className="mt-px size-3 shrink-0" />
      {text}
    </p>
  );
}

function ZoneBox({
  zone,
  letterOptions,
  letterError,
  incomplete,
  timeCheck,
  labelOf,
  pairTimeStyle,
  selected,
  activeDrag,
  onPairTap,
  onEmptySlotTap,
  onLetterChange,
}: {
  zone: ArmadoProZone;
  letterOptions: string[];
  letterError?: string;
  incomplete: boolean;
  timeCheck: ZoneTimeCheck | null;
  labelOf: (id: string) => string;
  pairTimeStyle: (pairId: string) => PairTimeStyle;
  selected: ArmadoProSource | null;
  activeDrag: DragData | null;
  onPairTap: (source: ArmadoProSource) => void;
  onEmptySlotTap: (zoneKey: string, index: number) => void;
  onLetterChange: (letter: string) => void;
}) {
  const {
    setNodeRef: setSortableNode,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `zone|${zone.key}`,
    data: { kind: "zone", zoneKey: zone.key } satisfies DropData,
  });
  const { setNodeRef: setBodyNode, isOver: isOverBody } = useDroppable({
    id: `zone-body|${zone.key}`,
    data: {
      kind: "target",
      target: { kind: "zone", zoneKey: zone.key },
      rank: 1,
    } satisfies DropData,
    disabled: zone.locked,
  });
  const missing = zone.slots.filter((id) => id === null).length;
  const highlightBody =
    activeDrag?.kind === "pair" && isOverBody && !zone.locked;

  return (
    <section
      ref={(node) => {
        setSortableNode(node);
        setBodyNode(node);
      }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-2 shadow-xs",
        incomplete &&
          "border-amber-400 bg-amber-50 dark:border-amber-500/70 dark:bg-amber-950/30",
        zone.locked && "border-dashed bg-muted/60",
        letterError && "border-red-400 dark:border-red-500/70",
        isDragging && "opacity-40",
        highlightBody && "ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <label
          className={cn(
            "relative grid size-8 shrink-0 place-items-center rounded-md text-sm font-bold",
            letterError
              ? "bg-red-600 text-white"
              : "bg-foreground text-background",
            zone.locked ? "opacity-60" : "cursor-pointer",
          )}
          title={letterError ?? "Cambiar la letra de la zona"}
        >
          {zone.letter}
          <select
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            value={zone.letter}
            disabled={zone.locked}
            onChange={(event) => onLetterChange(event.target.value)}
            aria-label={`Letra de ${armadoProZoneLabel(zone.letter)}`}
          >
            {letterOptions.map((letter) => (
              <option key={letter} value={letter}>
                {armadoProZoneLabel(letter)}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-medium">
            Zona de {zone.slots.length}
          </p>
          <p
            className={cn(
              "truncate text-[10px]",
              zone.locked
                ? "text-muted-foreground"
                : incomplete
                  ? "font-medium text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground",
            )}
          >
            {zone.locked ? (
              <span className="inline-flex items-center gap-0.5">
                <Lock className="size-2.5" />
                Con resultados
              </span>
            ) : incomplete ? (
              `Falta${missing === 1 ? "" : "n"} ${pluralize(missing, "pareja", "parejas")}`
            ) : (
              "Completa"
            )}
          </p>
        </div>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="grid size-8 shrink-0 cursor-grab touch-manipulation place-items-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          style={NO_SELECT_STYLE}
          aria-label={`Mover ${armadoProZoneLabel(zone.letter)} en el tablero`}
          title="Mover la zona en el tablero"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      {letterError ? (
        <p className="text-[10px] font-medium text-red-600 dark:text-red-400">
          {letterError}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        {zone.slots.map((pairId, index) => (
          <ZoneSlot
            key={index}
            zone={zone}
            index={index}
            pairId={pairId}
            labelOf={labelOf}
            timeStyle={pairId ? pairTimeStyle(pairId) : null}
            selected={selected}
            activeDrag={activeDrag}
            onPairTap={onPairTap}
            onEmptySlotTap={onEmptySlotTap}
          />
        ))}
      </div>
      {timeCheck ? <ZoneTimeVerdict check={timeCheck} /> : null}
      {zone.slots.length === 4 ? (
        <p className="text-[10px] text-muted-foreground">
          1.ª ronda: 1 vs 2 · 3 vs 4
        </p>
      ) : null}
    </section>
  );
}

function ZoneSlot({
  zone,
  index,
  pairId,
  labelOf,
  timeStyle,
  selected,
  activeDrag,
  onPairTap,
  onEmptySlotTap,
}: {
  zone: ArmadoProZone;
  index: number;
  pairId: string | null;
  labelOf: (id: string) => string;
  timeStyle: PairTimeStyle;
  selected: ArmadoProSource | null;
  activeDrag: DragData | null;
  onPairTap: (source: ArmadoProSource) => void;
  onEmptySlotTap: (zoneKey: string, index: number) => void;
}) {
  const source: ArmadoProSource = { kind: "slot", zoneKey: zone.key, index };
  const { setNodeRef, isOver: isOverSlot } = useDroppable({
    id: `slot|${zone.key}|${index}`,
    data: {
      kind: "target",
      target: { kind: "slot", zoneKey: zone.key, index },
      rank: 0,
    } satisfies DropData,
    disabled: zone.locked,
  });
  const draggedPair = activeDrag?.kind === "pair" ? activeDrag : null;
  const isOver = Boolean(draggedPair && isOverSlot && !zone.locked);
  const dropHint =
    isOver && pairId && draggedPair && draggedPair.pairId !== pairId
      ? draggedPair.source.kind === "slot" &&
        draggedPair.source.zoneKey === zone.key
        ? "Intercambian"
        : "Va al auxiliar"
      : null;

  return (
    <div ref={setNodeRef} className="flex min-w-0 items-stretch gap-1">
      <span className="w-3 shrink-0 pt-2 text-center text-[10px] text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      {pairId ? (
        <PairChip
          id={`slot|${zone.key}|${index}`}
          data={{ kind: "pair", source, pairId }}
          label={labelOf(pairId)}
          disabled={zone.locked}
          timeStyle={timeStyle}
          selected={Boolean(selected && sameSource(selected, source))}
          dropHint={dropHint}
          onTap={() => onPairTap(source)}
        />
      ) : (
        <button
          type="button"
          disabled={zone.locked}
          onClick={() => onEmptySlotTap(zone.key, index)}
          className={cn(
            "min-h-9 min-w-0 flex-1 rounded-lg border border-dashed border-amber-400 px-2 text-left text-[11px] text-amber-700 dark:text-amber-300",
            selected && "border-primary bg-primary/5 text-primary",
            isOver && "border-primary bg-primary/10 text-primary",
          )}
        >
          {selected ? "Ponerla acá" : "Falta pareja"}
        </button>
      )}
    </div>
  );
}

function PairChip({
  id,
  data,
  label,
  disabled = false,
  timeStyle,
  selected,
  dropHint,
  onTap,
}: {
  id: string;
  data: DragData;
  label: string;
  disabled?: boolean;
  timeStyle: PairTimeStyle;
  selected: boolean;
  dropHint?: string | null;
  onTap: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id,
    data,
    disabled,
  });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(event) => {
        event.stopPropagation();
        onTap();
      }}
      style={NO_SELECT_STYLE}
      className={cn(
        "relative min-h-9 min-w-0 flex-1 touch-manipulation rounded-lg border bg-background px-2 py-1 text-left text-[11px] leading-tight break-words select-none sm:text-xs",
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-grab active:cursor-grabbing",
        timeStyle?.tone,
        timeStyle?.dimmed && "opacity-35",
        selected && "border-primary ring-2 ring-primary/40",
        isDragging && "opacity-30",
        dropHint && "ring-2 ring-amber-500",
      )}
    >
      {label}
      {dropHint ? (
        <span className="absolute -top-2 right-1 rounded bg-amber-500 px-1 text-[9px] font-medium text-white">
          {dropHint}
        </span>
      ) : null}
    </button>
  );
}

function AuxPanel({
  aux,
  labelOf,
  pairTimeStyle,
  selected,
  activeDrag,
  onPairTap,
  onTap,
}: {
  aux: string[];
  labelOf: (id: string) => string;
  pairTimeStyle: (pairId: string) => PairTimeStyle;
  selected: ArmadoProSource | null;
  activeDrag: DragData | null;
  onPairTap: (source: ArmadoProSource) => void;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "aux",
    data: { kind: "target", target: { kind: "aux" }, rank: 2 } satisfies DropData,
  });
  const fromZone =
    (activeDrag?.kind === "pair" && activeDrag.source.kind === "slot") ||
    selected?.kind === "slot";
  const highlight = isOver && activeDrag?.kind === "pair";

  return (
    <aside
      ref={setNodeRef}
      onClick={onTap}
      className={cn(
        "flex max-h-[34vh] shrink-0 flex-col border-t bg-muted/40 pb-[env(safe-area-inset-bottom)] lg:max-h-none lg:w-72 lg:border-t-0 lg:border-l",
        fromZone && "bg-primary/5",
        highlight && "bg-primary/10 ring-2 ring-inset ring-primary/40",
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5 px-3 pt-2 pb-1 text-xs font-medium">
        <Inbox className="size-3.5 text-muted-foreground" />
        Auxiliar
        <span className="text-muted-foreground">· {aux.length}</span>
        {fromZone ? (
          <span className="ml-auto text-[10px] font-normal text-primary">
            Soltala o tocá acá para sacarla de la zona
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {aux.length === 0 ? (
          <p className="rounded-lg border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
            Sin parejas. Las que saques o pises de una zona quedan acá.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {aux.map((pairId) => {
              const source: ArmadoProSource = { kind: "aux", pairId };
              return (
                <div key={pairId} className="flex min-w-0">
                  <PairChip
                    id={`aux|${pairId}`}
                    data={{ kind: "pair", source, pairId }}
                    label={labelOf(pairId)}
                    timeStyle={pairTimeStyle(pairId)}
                    selected={Boolean(selected && sameSource(selected, source))}
                    onTap={() => onPairTap(source)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
