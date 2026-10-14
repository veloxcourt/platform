"use client";

import { useEffect, useRef, useTransition } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ClipboardPaste, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_PHONE_DIAL,
  formatPhoneDisplay,
  splitPhoneForForm,
} from "@/lib/phone";
import {
  newPlayerSchema,
  playerPhoneToE164,
  type NewPlayerValues,
  COURT_POSITIONS,
  COURT_POSITION_LABELS,
} from "@/modules/bookings/domain/new-player-schema";
import { updatePlayerAction } from "@/app/(dashboard)/[clubSlug]/turnos/actions";
import { CityCombobox } from "@/components/features/cities/city-combobox";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/// Campos de la grilla que se pueden editar de a uno, sin abrir la ficha completa.
export const PLAYER_FIELD_LABELS = {
  name: "Nombre y apellido",
  phone: "Teléfono",
  instagram: "Instagram",
  city: "Localidad",
  category: "Categoría",
  position: "Posición en cancha",
  ranking: "Ranking",
  points: "Puntos acumulados",
} as const;

export type PlayerFieldKey = keyof typeof PLAYER_FIELD_LABELS;

export type PlayerFieldTarget = {
  id: string;
  name: string;
  field: PlayerFieldKey;
  values: NewPlayerValues;
};

export function PlayerFieldDialog({
  clubSlug,
  categories,
  target,
  open,
  onOpenChange,
  onSaved,
}: {
  clubSlug: string;
  categories: string[];
  target: PlayerFieldTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const phoneRef = useRef<HTMLInputElement>(null);

  const form = useForm<NewPlayerValues>({
    resolver: zodResolver(newPlayerSchema),
  });
  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = form;

  // El form guarda la ficha entera: se precarga y solo se muestra el campo elegido.
  useEffect(() => {
    if (open && target) reset(target.values);
  }, [open, target, reset]);

  function onSubmit(values: NewPlayerValues) {
    if (!target) return;
    startTransition(async () => {
      const result = await updatePlayerAction(clubSlug, target.id, values);
      if (result.ok) {
        toast.success("Dato actualizado");
        onSaved?.();
        onOpenChange(false);
      } else {
        toast.error("No se pudo guardar", { description: result.error });
      }
    });
  }

  /// Un número pegado desde WhatsApp suele venir con +país: se separa solo.
  function applyPastedPhone(text: string) {
    if (text.startsWith("+")) {
      const { dial, local } = splitPhoneForForm(text);
      setValue("phoneCountryDial", dial, { shouldValidate: true });
      setValue("phoneLocal", local, { shouldValidate: true });
      return;
    }
    setValue("phoneLocal", text, { shouldValidate: true });
  }

  function phoneToCopy() {
    const local = watch("phoneLocal") ?? "";
    const e164 = playerPhoneToE164({
      phoneCountryDial: watch("phoneCountryDial") ?? DEFAULT_PHONE_DIAL,
      phoneLocal: local,
    });
    return formatPhoneDisplay(e164) || local;
  }

  const field = target?.field ?? "name";
  const label = PLAYER_FIELD_LABELS[field];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Por defecto el foco va al primer campo; en teléfono, al número y no al país. */}
      <DialogContent
        className="sm:max-w-sm"
        initialFocus={field === "phone" ? phoneRef : true}
      >
        <DialogHeader>
          <DialogTitle>Editar {label.toLowerCase()}</DialogTitle>
          <DialogDescription>{target?.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 text-sm">
          {field === "name" && (
            <>
              <ClipboardField
                form={form}
                name="firstName"
                label="Nombre"
                error={errors.firstName?.message}
              />
              <ClipboardField
                form={form}
                name="lastName"
                label="Apellido"
                error={errors.lastName?.message}
              />
            </>
          )}

          {field === "phone" && (
            <PhoneInput
              inputRef={phoneRef}
              dial={watch("phoneCountryDial") ?? DEFAULT_PHONE_DIAL}
              local={watch("phoneLocal") ?? ""}
              onDialChange={(dial) =>
                setValue("phoneCountryDial", dial, { shouldValidate: true })
              }
              onLocalChange={(local) =>
                setValue("phoneLocal", local, { shouldValidate: true })
              }
              error={errors.phoneLocal?.message}
              actions={
                <ClipboardButtons
                  what="teléfono"
                  onCopy={phoneToCopy}
                  onPaste={applyPastedPhone}
                />
              }
            />
          )}

          {field === "instagram" && (
            <ClipboardField
              form={form}
              name="instagram"
              label="Instagram"
              placeholder="@usuario"
              error={errors.instagram?.message}
            />
          )}

          {field === "city" && (
            <Field label="Localidad" error={errors.catalogCityId?.message}>
              <CityCombobox
                value={watch("catalogCityId") ?? ""}
                allowCreate
                clubSlug={clubSlug}
                onChange={(cityId, cityName) => {
                  setValue("catalogCityId", cityId, { shouldValidate: true });
                  setValue("city", cityName, { shouldValidate: true });
                }}
              />
            </Field>
          )}

          {field === "category" && (
            <Field label="Categoría">
              <select
                className={SELECT_CLASS}
                value={watch("category") ?? ""}
                onChange={(e) =>
                  setValue("category", e.target.value, { shouldValidate: true })
                }
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {field === "position" && (
            <Field label="Posición en cancha">
              <select
                className={SELECT_CLASS}
                value={watch("courtPosition") ?? ""}
                onChange={(e) =>
                  setValue(
                    "courtPosition",
                    e.target.value as NewPlayerValues["courtPosition"],
                    { shouldValidate: true },
                  )
                }
              >
                <option value="">—</option>
                {COURT_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {COURT_POSITION_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {field === "ranking" && (
            <Field label="Ranking" error={errors.ranking?.message}>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="—"
                  value={watch("ranking") ?? ""}
                  onChange={(e) =>
                    setValue("ranking", toNumberOrNull(e.target.value), {
                      shouldValidate: true,
                    })
                  }
                />
                <ClipboardButtons
                  what="ranking"
                  onCopy={() => String(watch("ranking") ?? "")}
                  onPaste={(text) =>
                    setValue("ranking", toNumberOrNull(text), {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </Field>
          )}

          {field === "points" && (
            <Field
              label="Puntos acumulados"
              error={errors.accumulatedPoints?.message}
            >
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={watch("accumulatedPoints") ?? 0}
                  onChange={(e) =>
                    setValue(
                      "accumulatedPoints",
                      toNumberOrNull(e.target.value) ?? 0,
                      { shouldValidate: true },
                    )
                  }
                />
                <ClipboardButtons
                  what="puntos"
                  onCopy={() => String(watch("accumulatedPoints") ?? 0)}
                  onPaste={(text) =>
                    setValue("accumulatedPoints", toNumberOrNull(text) ?? 0, {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </Field>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toNumberOrNull(value: string): number | null {
  const digits = value.replace(/[^\d-]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/// Campo de texto con copiar / pegar, para mover datos entre la app y WhatsApp.
type TextFieldName = "firstName" | "lastName" | "instagram" | "city";

function ClipboardField({
  form,
  name,
  label,
  placeholder,
  error,
}: {
  form: UseFormReturn<NewPlayerValues>;
  name: TextFieldName;
  label: string;
  placeholder?: string;
  error?: string;
}) {
  const value = form.watch(name) ?? "";
  return (
    <Field label={label} error={error}>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          aria-invalid={!!error}
          onChange={(e) =>
            form.setValue(name, e.target.value, { shouldValidate: true })
          }
        />
        <ClipboardButtons
          what={label.toLowerCase()}
          onCopy={() => value}
          onPaste={(text) =>
            form.setValue(name, text, { shouldValidate: true })
          }
        />
      </div>
    </Field>
  );
}

function ClipboardButtons({
  what,
  onCopy,
  onPaste,
}: {
  what: string;
  onCopy: () => string;
  onPaste: (text: string) => void;
}) {
  async function copy() {
    const text = onCopy().trim();
    if (!text) {
      toast.error(`No hay ${what} para copiar`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado", { description: text });
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast.error("El portapapeles está vacío");
        return;
      }
      onPaste(text);
    } catch {
      toast.error("No se pudo leer el portapapeles", {
        description: "Tocá el campo y pegá con Ctrl+V.",
      });
    }
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        title={`Copiar ${what}`}
        aria-label={`Copiar ${what}`}
        onClick={copy}
      >
        <Copy className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        title={`Pegar ${what}`}
        aria-label={`Pegar ${what}`}
        onClick={paste}
      >
        <ClipboardPaste className="size-4" />
      </Button>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
