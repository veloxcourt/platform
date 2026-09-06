"use client";

import { useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { formatShortDate } from "@/lib/date";
import type { TournamentConfig } from "@/modules/tournaments/domain/types";
import {
  MATCH_FORMAT_LABELS,
  MATCH_FORMAT_VALUES,
  FINAL_PHASE_START_ROUND_LABELS,
  FINAL_PHASE_START_ROUND_VALUES,
  TOURNAMENT_PHASE_KEYS,
  TOURNAMENT_PHASE_META,
  ZONE4_ADVANCERS_LABELS,
  ZONE4_ADVANCERS_VALUES,
  tournamentConfigSchema,
  type TournamentConfigValues,
  type TournamentPhaseKey,
} from "@/modules/tournaments/domain/config-schema";
import {
  intermediateMatchCount,
  intermediateRoundLabels,
} from "@/modules/tournaments/domain/bracket-rounds";
import { saveTournamentConfigAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/configuracion/actions";
import {
  materializePlayDaySelection,
  playDayRulerSelectedMinutes,
  toPlayDayValues,
  zonesPlaySlotMinutes,
} from "@/modules/tournaments/domain/play-day-slots";
import { useTournamentReadOnly } from "./tournament-mode-context";
import {
  PlayDaySlotRuler,
  PlayDaysRulerToolbar,
  playDayRulerState,
} from "./play-day-slot-ruler";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Fondos distintos por fase para separar paneles en la config. */
const PHASE_PANEL_CLASS: Record<TournamentPhaseKey, string> = {
  zones: "rounded-lg border border-teal-200/80 bg-teal-50/90 p-3",
  knockout: "rounded-lg border border-amber-200/80 bg-amber-50/90 p-3",
  final: "rounded-lg border border-sky-200/80 bg-sky-50/90 p-3",
};

function formatCourtHours(totalMinutes: number): string {
  if (totalMinutes <= 0) return "—";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} h`;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function formatSlotsWithClock(slotCount: number, totalMinutes: number): string {
  const label = `${slotCount} slot${slotCount === 1 ? "" : "s"}`;
  if (totalMinutes <= 0) return label;
  return `${label} (${formatCourtHours(totalMinutes)})`;
}

function PhaseFields({
  categoryIndex,
  phase,
  control,
  register,
  setValue,
  errors,
  playDays,
  finalStartsAtRound,
}: {
  categoryIndex: number;
  phase: TournamentPhaseKey;
  control: ReturnType<typeof useForm<TournamentConfigValues>>["control"];
  register: ReturnType<typeof useForm<TournamentConfigValues>>["register"];
  setValue: ReturnType<typeof useForm<TournamentConfigValues>>["setValue"];
  errors: ReturnType<
    typeof useForm<TournamentConfigValues>
  >["formState"]["errors"];
  playDays: TournamentConfigValues["playDays"];
  finalStartsAtRound?: TournamentConfigValues["categories"][number]["phases"]["final"]["startsAtRound"];
}) {
  const meta = TOURNAMENT_PHASE_META[phase];
  const phaseErrors = errors.categories?.[categoryIndex]?.phases?.[phase];
  const intermediateLabels =
    phase === "knockout" && finalStartsAtRound
      ? intermediateRoundLabels(finalStartsAtRound)
      : [];
  const intermediateMatches =
    phase === "knockout" && finalStartsAtRound
      ? intermediateMatchCount(finalStartsAtRound)
      : 0;
  const base = `categories.${categoryIndex}.phases.${phase}` as const;
  const selectedDates =
    useWatch({
      control,
      name: `${base}.playDates`,
    }) ?? [];

  const readOnly = useTournamentReadOnly();

  function togglePlayDate(date: string, checked: boolean) {
    if (readOnly || !date) return;
    const current = Array.isArray(selectedDates) ? selectedDates : [];
    const next = checked
      ? current.includes(date)
        ? current
        : [...current, date]
      : current.filter((d) => d !== date);
    setValue(`${base}.playDates`, next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <div className={PHASE_PANEL_CLASS[phase]}>
      <div className="mb-3">
        <p className="font-medium">{meta.label}</p>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
        {phase === "knockout" && intermediateLabels.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Instancias en esta fase: {intermediateLabels.join(", ")} (
            {intermediateMatches} partidos con llave de 32 parejas).
          </p>
        )}
        {phase === "knockout" && intermediateLabels.length === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Sin rondas intermedias: la fase final comienza en 16 avos.
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {phase === "final" && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Comienza en</Label>
            <select
              className={SELECT_CLASS}
              disabled={readOnly}
              {...register(`categories.${categoryIndex}.phases.final.startsAtRound`)}
            >
              {FINAL_PHASE_START_ROUND_VALUES.map((round) => (
                <option key={round} value={round}>
                  {FINAL_PHASE_START_ROUND_LABELS[round]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Las instancias anteriores se juegan con el formato de la fase
              intermedia.
            </p>
            {errors.categories?.[categoryIndex]?.phases?.final
              ?.startsAtRound && (
              <p className="text-xs text-destructive">
                {
                  errors.categories[categoryIndex]?.phases?.final?.startsAtRound
                    ?.message
                }
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Formato</Label>
          <select
            className={SELECT_CLASS}
            disabled={readOnly}
            {...register(`${base}.matchFormat`)}
          >
            {MATCH_FORMAT_VALUES.map((f) => (
              <option key={f} value={f}>
                {MATCH_FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Duración (min)</Label>
          <Input
            type="number"
            min={30}
            max={180}
            step={15}
            disabled={readOnly}
            readOnly={readOnly}
            {...register(`${base}.matchDurationMin`, { valueAsNumber: true })}
          />
          {phaseErrors?.matchDurationMin && (
            <p className="text-xs text-destructive">
              {phaseErrors.matchDurationMin.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Días de juego de esta fase</Label>
          {playDays.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Definí inicio y fin del torneo en Info para ver los días de juego.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {playDays.map((day, dayIndex) => {
                const date = day?.date ?? "";
                const label = `Día ${dayIndex + 1}`;
                const checked = Boolean(date && selectedDates.includes(date));
                return (
                  <label
                    key={`${phase}-${dayIndex}-${date || "empty"}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border/80 bg-background/90 px-2.5 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={readOnly || !date}
                      onCheckedChange={(value) =>
                        togglePlayDate(date, value === true)
                      }
                      aria-label={`${meta.label}: ${label}`}
                    />
                    <span className="font-medium">{label}</span>
                    {date ? (
                      <span className="text-xs text-muted-foreground">
                        {formatShortDate(date)}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Indicá en qué días se juega esta fase (sirve para evaluar la
            disponibilidad por fase).
          </p>
        </div>
      </div>
    </div>
  );
}

function CategoryPhaseCard({
  categoryIndex,
  categoryName,
  control,
  register,
  setValue,
  errors,
  playDays,
}: {
  categoryIndex: number;
  categoryName: string;
  control: ReturnType<typeof useForm<TournamentConfigValues>>["control"];
  register: ReturnType<typeof useForm<TournamentConfigValues>>["register"];
  setValue: ReturnType<typeof useForm<TournamentConfigValues>>["setValue"];
  errors: ReturnType<
    typeof useForm<TournamentConfigValues>
  >["formState"]["errors"];
  playDays: TournamentConfigValues["playDays"];
}) {
  const readOnly = useTournamentReadOnly();
  const finalStartsAtRound = useWatch({
    control,
    name: `categories.${categoryIndex}.phases.final.startsAtRound`,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{categoryName}</CardTitle>
        <CardAction>
          <AyudaButton
            title={`Ayuda de ${categoryName}`}
            description="Formato y días por fase de esta categoría."
          >
            <p>
              Formato por fase para esta categoría del torneo. Asigná los días
              en los que se juega cada fase.
            </p>
          </AyudaButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <input
          type="hidden"
          {...register(`categories.${categoryIndex}.categoryId`)}
        />
        {TOURNAMENT_PHASE_KEYS.map((phase) => (
          <PhaseFields
            key={phase}
            categoryIndex={categoryIndex}
            phase={phase}
            control={control}
            register={register}
            setValue={setValue}
            errors={errors}
            playDays={playDays}
            finalStartsAtRound={finalStartsAtRound}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SharedParametersCard({
  register,
  errors,
  categoryCount,
}: {
  register: ReturnType<typeof useForm<TournamentConfigValues>>["register"];
  errors: ReturnType<
    typeof useForm<TournamentConfigValues>
  >["formState"]["errors"];
  categoryCount: number;
}) {
  const readOnly = useTournamentReadOnly();
  // Por ahora pairs/interval son comunes: editamos la 1ª categoría y al guardar
  // se copian al resto.
  const firstErrors = errors.categories?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parámetros comunes</CardTitle>
        <CardAction>
          <AyudaButton
            title="Ayuda de parámetros"
            description="Valores que aplican a todas las categorías."
          >
            <p>Aplican a todas las categorías del torneo.</p>
          </AyudaButton>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 rounded-lg border border-muted-foreground/15 bg-muted/40 p-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="court-count">Canchas disponibles</Label>
            <Input
              id="court-count"
              type="number"
              min={1}
              max={32}
              step={1}
              className="max-w-[200px]"
              disabled={readOnly}
              readOnly={readOnly}
              {...register("courtCount", { valueAsNumber: true })}
            />
            {errors.courtCount && (
              <p className="text-xs text-destructive">
                {errors.courtCount.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Capacidad en paralelo (días × horarios × canchas).
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pairs-per-zone-shared">Parejas por zona</Label>
            <Input
              id="pairs-per-zone-shared"
              type="number"
              min={2}
              max={8}
              step={1}
              className="max-w-[200px]"
              disabled={readOnly || categoryCount === 0}
              readOnly={readOnly}
              {...register("categories.0.pairsPerZone", {
                valueAsNumber: true,
              })}
            />
            {firstErrors?.pairsPerZone && (
              <p className="text-xs text-destructive">
                {firstErrors.pairsPerZone.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Tamaño objetivo de cada zona (habitualmente 3).
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zone4-advancers-shared">
              Avance en zonas de 4
            </Label>
            <select
              id="zone4-advancers-shared"
              className={`${SELECT_CLASS} max-w-[280px]`}
              disabled={readOnly || categoryCount === 0}
              {...register("categories.0.zone4Advancers", {
                valueAsNumber: true,
              })}
            >
              {ZONE4_ADVANCERS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {ZONE4_ADVANCERS_LABELS[value]}
                </option>
              ))}
            </select>
            {firstErrors?.zone4Advancers && (
              <p className="text-xs text-destructive">
                {firstErrors.zone4Advancers.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Federación (FAP) pasa 3; Asociación (APA) pasa 2.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interval-shared">
              Intervalo entre partidos (min)
            </Label>
            <Input
              id="interval-shared"
              type="number"
              min={0}
              max={60}
              step={5}
              className="max-w-[200px]"
              disabled={readOnly || categoryCount === 0}
              readOnly={readOnly}
              {...register("categories.0.intervalMin", {
                valueAsNumber: true,
              })}
            />
            {firstErrors?.intervalMin && (
              <p className="text-xs text-destructive">
                {firstErrors.intervalMin.message}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TournamentConfigForm({
  clubSlug,
  tournamentId,
  initial,
  /** Si se indica, muestra solo el formato de esa categoría. */
  focusCategoryId,
  /**
   * parameters: parejas/intervalo + días/canchas
   * category: solo formato por fase
   * all: todo (ruta standalone)
   */
  panel = "all",
}: {
  clubSlug: string;
  tournamentId: string;
  initial: TournamentConfig;
  focusCategoryId?: string;
  panel?: "parameters" | "category" | "all";
}) {
  const readOnly = useTournamentReadOnly();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TournamentConfigValues>({
    resolver: zodResolver(tournamentConfigSchema),
    defaultValues: {
      courtCount: initial.courtCount ?? 1,
      playDays: initial.playDays.map((day) => toPlayDayValues(day)),
      categories: initial.categories.map((category) => ({
        categoryId: category.categoryId,
        phases: {
          zones: {
            ...category.phases.zones,
            playDates: category.phases.zones.playDates ?? [],
          },
          knockout: {
            ...category.phases.knockout,
            playDates: category.phases.knockout.playDates ?? [],
          },
          final: {
            ...category.phases.final,
            playDates: category.phases.final.playDates ?? [],
          },
        },
        intervalMin: category.intervalMin,
        pairsPerZone: category.pairsPerZone ?? 3,
        zone4Advancers: category.zone4Advancers === 2 ? 2 : 3,
      })),
    },
  });

  const { fields } = useFieldArray({
    control,
    name: "playDays",
  });

  const courtCount = useWatch({ control, name: "courtCount" }) ?? 1;
  const playDaysWatch = useWatch({ control, name: "playDays" }) ?? [];
  const zonesDuration =
    useWatch({
      control,
      name: "categories.0.phases.zones.matchDurationMin",
    }) ?? 75;
  const intervalMin = useWatch({ control, name: "categories.0.intervalMin" }) ?? 0;
  const slotMinutes = zonesPlaySlotMinutes(zonesDuration, intervalMin);
  const courts =
    Number.isFinite(courtCount) && courtCount > 0 ? Number(courtCount) : 0;
  const tournamentTotalMinutes = playDaysWatch.reduce((sum, day) => {
    if (!day?.startTime) return sum;
    const minutes = playDayRulerSelectedMinutes(day, slotMinutes);
    return minutes > 0 ? sum + minutes * courts : sum;
  }, 0);
  const tournamentTotalSlots =
    slotMinutes > 0 ? Math.round(tournamentTotalMinutes / slotMinutes) : 0;
  const rulerTotals = playDaysWatch.reduce(
    (acc, day) => {
      const { ruler, enabled } = playDayRulerState(day, slotMinutes);
      acc.total += ruler.length;
      acc.marked += enabled.length;
      return acc;
    },
    { total: 0, marked: 0 },
  );

  const showParameters = panel === "parameters" || panel === "all";
  const showCategories = panel === "category" || panel === "all";

  function onSubmit(values: TournamentConfigValues) {
    const validDates = new Set(
      values.playDays.map((d) => d.date).filter(Boolean),
    );
    const sharedPairs = values.categories[0]?.pairsPerZone ?? 3;
    const sharedZone4Advancers =
      values.categories[0]?.zone4Advancers === 2 ? 2 : 3;
    const sharedInterval = values.categories[0]?.intervalMin ?? 0;
    const slotMin = zonesPlaySlotMinutes(
      values.categories[0]?.phases.zones.matchDurationMin,
      sharedInterval,
    );
    const sanitized: TournamentConfigValues = {
      ...values,
      playDays: values.playDays.map((day) =>
        materializePlayDaySelection(toPlayDayValues(day), slotMin),
      ),
      categories: values.categories.map((category) => ({
        ...category,
        // Comunes a todas las categorías (por ahora).
        pairsPerZone: sharedPairs,
        zone4Advancers: sharedZone4Advancers,
        intervalMin: sharedInterval,
        phases: {
          zones: {
            ...category.phases.zones,
            playDates: category.phases.zones.playDates.filter((d) =>
              validDates.has(d),
            ),
          },
          knockout: {
            ...category.phases.knockout,
            playDates: category.phases.knockout.playDates.filter((d) =>
              validDates.has(d),
            ),
          },
          final: {
            ...category.phases.final,
            playDates: category.phases.final.playDates.filter((d) =>
              validDates.has(d),
            ),
          },
        },
      })),
    };

    if (readOnly) return;

    startTransition(async () => {
      const result = await saveTournamentConfigAction(
        clubSlug,
        tournamentId,
        sanitized,
      );
      if (result.ok) toast.success("Configuración guardada");
      else toast.error("No se pudo guardar", { description: result.error });
    });
  }

  if (initial.categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Agregá al menos una categoría en la sub-pestaña Categorías antes de
        configurar parámetros y formato por fase.
      </div>
    );
  }

  const focusedCategories = focusCategoryId
    ? initial.categories
        .map((category, index) => ({ category, index }))
        .filter(({ category }) => category.categoryId === focusCategoryId)
    : initial.categories.map((category, index) => ({ category, index }));

  if (showCategories && focusCategoryId && focusedCategories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No se encontró la configuración de esta categoría. Probá guardar o
        volver a Categorías.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full min-w-0 flex-col gap-4"
    >
      {showParameters ? (
        <SharedParametersCard
          register={register}
          errors={errors}
          categoryCount={initial.categories.length}
        />
      ) : null}

      {showCategories
        ? focusedCategories.map(({ category, index }) => (
            <CategoryPhaseCard
              key={category.categoryId}
              categoryIndex={index}
              categoryName={category.categoryName}
              control={control}
              register={register}
              setValue={setValue}
              errors={errors}
              playDays={playDaysWatch}
            />
          ))
        : null}

      {showParameters ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Días y horarios de juego</CardTitle>
              <CardAction>
                <AyudaButton
                  title="Ayuda de días y horarios"
                  description="Cómo se marcan las franjas de juego."
                >
                  <p>
                    Los días salen de Info (inicio y fin del torneo). Usá +/− a
                    izquierda y derecha para sumar o quitar slots (el nuevo
                    queda en juego). Podés desmarcar celdas sueltas. El tamaño
                    de cada slot es la duración de zonas más el intervalo.
                  </p>
                  <p>
                    A la izquierda +/− mueve el inicio; a la derecha +/− alarga
                    o acorta el final (incluso después de las 0 hs). La
                    capacidad se expresa en slots (horas reloj entre
                    paréntesis).
                  </p>
                  <p>
                    Para cambiar las fechas, usá la pestaña Info. Los horarios
                    valen para todo el torneo; al armar el fixture se reparten
                    los partidos de cada categoría dentro de esas franjas.
                  </p>
                </AyudaButton>
              </CardAction>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-3 overflow-x-auto">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Definí inicio y fin del torneo en Info.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block size-3 rounded-sm border border-emerald-300/80 bg-emerald-50"
                        aria-hidden
                      />
                      Libre
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block size-3 rounded-sm border border-sky-400 bg-sky-100"
                        aria-hidden
                      />
                      En juego
                    </span>
                  </div>
                  <PlayDaysRulerToolbar
                    markedCount={rulerTotals.marked}
                    allMarked={
                      rulerTotals.total > 0 &&
                      rulerTotals.marked === rulerTotals.total
                    }
                    noneMarked={rulerTotals.marked === 0}
                    readOnly={readOnly}
                    slotMinutes={slotMinutes}
                    onMarkAll={() => {
                      fields.forEach((_, index) => {
                        const day = playDaysWatch[index];
                        const { ruler, overnight } = playDayRulerState(
                          day,
                          slotMinutes,
                        );
                        setValue(
                          `playDays.${index}.enabledSlotIndexes`,
                          ruler.map((slot) => slot.slotIndex),
                          { shouldDirty: true },
                        );
                        setValue(`playDays.${index}.hasSlotSelection`, true, {
                          shouldDirty: true,
                        });
                        setValue(
                          `playDays.${index}.overnightExtraSlots`,
                          overnight,
                          { shouldDirty: true },
                        );
                        const endTime = ruler[ruler.length - 1]?.endTime;
                        if (endTime) {
                          setValue(`playDays.${index}.endTime`, endTime, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      });
                    }}
                    onClearAll={() => {
                      fields.forEach((_, index) => {
                        const day = playDaysWatch[index];
                        const { ruler, overnight } = playDayRulerState(
                          day,
                          slotMinutes,
                        );
                        setValue(`playDays.${index}.enabledSlotIndexes`, [], {
                          shouldDirty: true,
                        });
                        setValue(`playDays.${index}.hasSlotSelection`, true, {
                          shouldDirty: true,
                        });
                        setValue(
                          `playDays.${index}.overnightExtraSlots`,
                          overnight,
                          { shouldDirty: true },
                        );
                        const endTime = ruler[ruler.length - 1]?.endTime;
                        if (endTime) {
                          setValue(`playDays.${index}.endTime`, endTime, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      });
                    }}
                  />
                  {fields.map((field, index) => (
                    <PlayDaySlotRuler
                      key={field.id}
                      index={index}
                      control={control}
                      setValue={setValue}
                      errors={errors}
                      courtCount={courts}
                      slotMinutes={slotMinutes}
                      readOnly={readOnly}
                    />
                  ))}
                </>
              )}
              {errors.playDays?.message && (
                <p className="text-xs text-destructive">
                  {errors.playDays.message}
                </p>
              )}
              {tournamentTotalSlots > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Capacidad total del torneo (todas las franjas × canchas)
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatSlotsWithClock(
                      tournamentTotalSlots,
                      tournamentTotalMinutes,
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      )}
    </form>
  );
}
