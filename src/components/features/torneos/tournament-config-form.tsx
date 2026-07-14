"use client";

import { useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate } from "@/lib/date";
import type { TournamentConfig } from "@/modules/tournaments/domain/types";
import {
  MATCH_FORMAT_LABELS,
  MATCH_FORMAT_VALUES,
  FINAL_PHASE_START_ROUND_LABELS,
  FINAL_PHASE_START_ROUND_VALUES,
  TOURNAMENT_PHASE_KEYS,
  TOURNAMENT_PHASE_META,
  tournamentConfigSchema,
  type TournamentConfigValues,
  type TournamentPhaseKey,
} from "@/modules/tournaments/domain/config-schema";
import {
  intermediateMatchCount,
  intermediateRoundLabels,
} from "@/modules/tournaments/domain/bracket-rounds";
import { saveTournamentConfigAction } from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/configuracion/actions";
import { playDayEndHint, formatPlayDayDuration, playDayWindowMinutes } from "@/modules/tournaments/domain/play-day";

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

  function togglePlayDate(date: string, checked: boolean) {
    if (!date) return;
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
              Agregá días de juego abajo para poder asignarlos a esta fase.
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
                      disabled={!date}
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

function PlayDayRow({
  index,
  control,
  register,
  errors,
  courtCount,
  onRemove,
  canRemove,
}: {
  index: number;
  control: ReturnType<typeof useForm<TournamentConfigValues>>["control"];
  register: ReturnType<typeof useForm<TournamentConfigValues>>["register"];
  errors: ReturnType<
    typeof useForm<TournamentConfigValues>
  >["formState"]["errors"];
  courtCount: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const startTime = useWatch({
    control,
    name: `playDays.${index}.startTime`,
  });
  const endTime = useWatch({
    control,
    name: `playDays.${index}.endTime`,
  });
  const endHint =
    startTime && endTime ? playDayEndHint(startTime, endTime) : null;
  const durationLabel =
    startTime && endTime ? formatPlayDayDuration(startTime, endTime) : null;
  const windowMinutes =
    startTime && endTime ? playDayWindowMinutes(startTime, endTime) : 0;
  const courts = Number.isFinite(courtCount) && courtCount > 0 ? courtCount : 0;
  const totalMinutes = windowMinutes > 0 && courts > 0 ? windowMinutes * courts : 0;
  const totalHoursLabel = totalMinutes > 0 ? formatCourtHours(totalMinutes) : null;

  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_6.5rem_7.5rem_auto]">
      <div className="flex flex-col gap-1.5">
        <Label>Fecha</Label>
        <Input type="date" {...register(`playDays.${index}.date`)} />
        {errors.playDays?.[index]?.date && (
          <p className="text-xs text-destructive">
            {errors.playDays[index]?.date?.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Día de inicio del bloque habilitado.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Desde</Label>
        <Input type="time" {...register(`playDays.${index}.startTime`)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Hasta</Label>
        <Input type="time" {...register(`playDays.${index}.endTime`)} />
        {endHint && (
          <p className="text-xs text-muted-foreground">{endHint}</p>
        )}
        {errors.playDays?.[index]?.endTime && (
          <p className="text-xs text-destructive">
            {errors.playDays[index]?.endTime?.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Horas</Label>
        <div
          className="flex h-8 items-center rounded-lg border border-dashed bg-muted/40 px-2.5 text-sm tabular-nums"
          aria-live="polite"
        >
          {durationLabel ?? "—"}
        </div>
        <p className="text-xs text-muted-foreground">Duración del bloque.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Horas totales</Label>
        <div
          className="flex h-8 items-center rounded-lg border border-dashed bg-muted/40 px-2.5 text-sm font-medium tabular-nums"
          aria-live="polite"
          title={
            courts > 0 && durationLabel
              ? `${durationLabel} × ${courts} cancha${courts === 1 ? "" : "s"}`
              : undefined
          }
        >
          {totalHoursLabel ?? "—"}
        </div>
        <p className="text-xs text-muted-foreground">
          Horas × canchas.
        </p>
      </div>
      <div className="flex items-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          title="Quitar día"
        >
          <Trash2 className="size-4" />
        </Button>
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
  const finalStartsAtRound = useWatch({
    control,
    name: `categories.${categoryIndex}.phases.final.startsAtRound`,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{categoryName}</CardTitle>
        <CardDescription>
          Formato por fase para esta categoría del torneo. Asigná los días en
          los que se juega cada fase.
        </CardDescription>
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
        <div className="grid gap-3 rounded-lg border border-muted-foreground/15 bg-muted/40 p-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`pairs-per-zone-${categoryIndex}`}>
              Parejas por zona
            </Label>
            <Input
              id={`pairs-per-zone-${categoryIndex}`}
              type="number"
              min={2}
              max={8}
              step={1}
              className="max-w-[200px]"
              {...register(`categories.${categoryIndex}.pairsPerZone`, {
                valueAsNumber: true,
              })}
            />
            {errors.categories?.[categoryIndex]?.pairsPerZone && (
              <p className="text-xs text-destructive">
                {errors.categories[categoryIndex]?.pairsPerZone?.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Tamaño objetivo de cada zona (habitualmente 3).
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`interval-${categoryIndex}`}>
              Intervalo entre partidos (min)
            </Label>
            <Input
              id={`interval-${categoryIndex}`}
              type="number"
              min={0}
              max={60}
              step={5}
              className="max-w-[200px]"
              {...register(`categories.${categoryIndex}.intervalMin`, {
                valueAsNumber: true,
              })}
            />
            {errors.categories?.[categoryIndex]?.intervalMin && (
              <p className="text-xs text-destructive">
                {errors.categories[categoryIndex]?.intervalMin?.message}
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
}: {
  clubSlug: string;
  tournamentId: string;
  initial: TournamentConfig;
}) {
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
      playDays: initial.playDays,
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
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "playDays",
  });

  const courtCount = useWatch({ control, name: "courtCount" }) ?? 1;
  const playDaysWatch = useWatch({ control, name: "playDays" }) ?? [];
  const courts =
    Number.isFinite(courtCount) && courtCount > 0 ? Number(courtCount) : 0;
  const tournamentTotalMinutes = playDaysWatch.reduce((sum, day) => {
    if (!day?.startTime || !day?.endTime) return sum;
    const minutes = playDayWindowMinutes(day.startTime, day.endTime);
    return minutes > 0 ? sum + minutes * courts : sum;
  }, 0);

  function onSubmit(values: TournamentConfigValues) {
    const validDates = new Set(
      values.playDays.map((d) => d.date).filter(Boolean),
    );
    const sanitized: TournamentConfigValues = {
      ...values,
      categories: values.categories.map((category) => ({
        ...category,
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
        Agregá al menos una categoría al torneo antes de configurar el formato
        por fase.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {initial.categories.map((category, index) => (
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
      ))}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Días y horarios de juego</CardTitle>
            <CardDescription>
              Común a todas las categorías: canchas, fechas y horarios
              habilitados para jugar durante el torneo.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                date: initial.startDate,
                startTime: "09:00",
                endTime: "22:00",
              })
            }
          >
            <Plus className="size-4" />
            Agregar día
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="court-count">Canchas disponibles</Label>
            <Input
              id="court-count"
              type="number"
              min={1}
              max={32}
              step={1}
              className="max-w-[200px]"
              {...register("courtCount", { valueAsNumber: true })}
            />
            {errors.courtCount && (
              <p className="text-xs text-destructive">
                {errors.courtCount.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Define la capacidad en paralelo para la simulación y el armado de
              fixture (tiempo disponible = días × horarios × canchas).
            </p>
          </div>

          {fields.map((field, index) => (
            <PlayDayRow
              key={field.id}
              index={index}
              control={control}
              register={register}
              errors={errors}
              courtCount={courts}
              onRemove={() => remove(index)}
              canRemove={fields.length > 1}
            />
          ))}
          {errors.playDays?.message && (
            <p className="text-xs text-destructive">{errors.playDays.message}</p>
          )}
          {tournamentTotalMinutes > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Capacidad total del torneo (todas las franjas × canchas)
              </span>
              <span className="font-semibold tabular-nums">
                {formatCourtHours(tournamentTotalMinutes)}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Si el horario de cierre es anterior al de inicio (ej. 18:00 a 02:00),
            se interpreta como madrugada del día siguiente. Las horas totales
            por día se comparan con las horas de partidos programados ese día.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Periodo del torneo: {formatShortDate(initial.startDate)}
        {initial.endDate && initial.endDate !== initial.startDate
          ? ` – ${formatShortDate(initial.endDate)}`
          : ""}
        . Los días y horarios valen para todo el torneo; al armar el fixture se
        reparten los partidos de cada categoría dentro de esas franjas.
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </form>
  );
}
