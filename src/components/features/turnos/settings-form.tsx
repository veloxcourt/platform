"use client";

import { useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  turnosConfigSchema,
  type TurnosConfigValues,
} from "@/modules/bookings/domain/settings-schema";
import type { BookingSettings, Court } from "@/modules/bookings/domain/types";
import type { SellableProduct } from "@/modules/catalog/domain/types";
import { formatMoney } from "@/lib/money";
import { saveTurnosConfig } from "@/app/(dashboard)/[clubSlug]/turnos/configuracion/actions";

interface Props {
  clubSlug: string;
  initialSettings: BookingSettings;
  initialCourts: Court[];
  products: SellableProduct[];
  currency?: string;
}

const MAX_COURTS = 20;
const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SettingsForm({
  clubSlug,
  initialSettings,
  initialCourts,
  products,
  currency = "ARS",
}: Props) {
  const [isPending, startTransition] = useTransition();

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TurnosConfigValues>({
    resolver: zodResolver(turnosConfigSchema),
    defaultValues: {
      settings: {
        openTime: initialSettings.openTime,
        closeTime: initialSettings.closeTime,
        slotDurationMin: initialSettings.slotDurationMin,
        intervalMin: initialSettings.intervalMin,
        preReservationMin: initialSettings.preReservationMin,
        requirePrePayment: initialSettings.requirePrePayment,
        turnoProductId: initialSettings.turnoProductId,
      },
      courts: initialCourts.map((c) => ({
        id: c.id,
        name: c.name,
        active: c.active,
      })),
    },
  });

  const selectedProductId = watch("settings.turnoProductId");
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "courts",
  });

  function setCourtCount(target: number) {
    const clamped = Math.max(1, Math.min(MAX_COURTS, target));
    const current = fields.length;
    if (clamped > current) {
      for (let i = current; i < clamped; i++) {
        append({ name: `Cancha ${i + 1}`, active: true });
      }
    } else if (clamped < current) {
      for (let i = current - 1; i >= clamped; i--) {
        remove(i);
      }
    }
  }

  function onSubmit(values: TurnosConfigValues) {
    startTransition(async () => {
      const result = await saveTurnosConfig(clubSlug, values);
      if (result.ok) {
        toast.success("Configuración guardada", {
          description: "El calendario ya refleja los cambios.",
        });
      } else {
        toast.error("No se pudo guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Parámetros generales */}
      <Card>
        <CardHeader>
          <CardTitle>Parámetros de turnos</CardTitle>
          <CardDescription>
            Estos valores aplican a este club y definen cómo se dibuja y se
            comporta el calendario.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Horario de apertura" error={errors.settings?.openTime?.message}>
            <Input type="time" {...register("settings.openTime")} />
          </Field>
          <Field
            label="Horario de cierre"
            error={errors.settings?.closeTime?.message}
            hint="Usá 00:00 para permitir turnos que terminan a la medianoche."
          >
            <Input type="time" {...register("settings.closeTime")} />
          </Field>
          <Field
            label="Duración del turno (min)"
            error={errors.settings?.slotDurationMin?.message}
          >
            <Input
              type="number"
              min={15}
              step={5}
              {...register("settings.slotDurationMin", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Intervalo entre turnos (min)"
            error={errors.settings?.intervalMin?.message}
          >
            <Input
              type="number"
              min={0}
              step={5}
              {...register("settings.intervalMin", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Vencimiento de pre-reserva (min)"
            error={errors.settings?.preReservationMin?.message}
          >
            <Input
              type="number"
              min={1}
              step={1}
              {...register("settings.preReservationMin", {
                valueAsNumber: true,
              })}
            />
          </Field>
          <Field
            label="Producto que define el precio del turno"
            error={errors.settings?.turnoProductId?.message}
            hint={
              products.length === 0
                ? "No hay productos activos en el catálogo. Creá uno para asignar el precio."
                : selectedProduct
                  ? `Precio actual: ${formatMoney(selectedProduct.price, currency)}`
                  : "El precio del turno se toma de este producto del catálogo."
            }
          >
            <select
              className={SELECT_CLASS}
              defaultValue={initialSettings.turnoProductId ?? ""}
              {...register("settings.turnoProductId", {
                setValueAs: (v) => (v ? String(v) : null),
              })}
            >
              <option value="">Sin precio (gratis)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatMoney(p.price, currency)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Requiere pago previo</p>
              <p className="text-xs text-muted-foreground">
                Si está activo, la reserva exige pago para confirmarse.
              </p>
            </div>
            <Controller
              control={control}
              name="settings.requirePrePayment"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Canchas */}
      <Card>
        <CardHeader>
          <CardTitle>Canchas</CardTitle>
          <CardDescription>
            La cantidad de canchas activas determina cuántas columnas se ven en
            la grilla.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm">Cantidad de canchas</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setCourtCount(fields.length - 1)}
                aria-label="Quitar una cancha"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-8 text-center text-sm tabular-nums">
                {fields.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setCourtCount(fields.length + 1)}
                aria-label="Agregar una cancha"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <Input
                  className="flex-1"
                  placeholder={`Cancha ${index + 1}`}
                  {...register(`courts.${index}.name`)}
                />
                <Controller
                  control={control}
                  name={`courts.${index}.active`}
                  render={({ field: f }) => (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={f.value}
                        onCheckedChange={f.onChange}
                      />
                      Activa
                    </label>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => fields.length > 1 && remove(index)}
                  disabled={fields.length <= 1}
                  aria-label="Eliminar cancha"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          {errors.courts?.message && (
            <p className="text-xs text-destructive">{errors.courts.message}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
