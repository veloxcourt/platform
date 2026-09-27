"use client";

import { useActionState, type ReactNode } from "react";

import { submitPublicPlayerSignupAction } from "@/app/alta/[clubSlug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_PHONE_DIAL, PHONE_COUNTRIES } from "@/lib/phone";
import {
  COURT_POSITION_LABELS,
  COURT_POSITIONS,
  GENDER_LABELS,
  GENDERS,
} from "@/modules/bookings/domain/new-player-schema";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PublicPlayerSignupForm({
  clubSlug,
  clubName,
  categories,
}: {
  clubSlug: string;
  clubName: string;
  categories: string[];
}) {
  const [state, action, pending] = useActionState(
    submitPublicPlayerSignupAction,
    {},
  );

  if (state.ok) {
    return (
      <div className="rounded-xl border bg-background p-6 text-sm">
        <p className="font-medium">
          {state.already ? "Ya estabas en el listado" : "Listo, quedaste registrado"}
        </p>
        <p className="mt-2 text-muted-foreground">
          {state.already
            ? `${state.clubName ?? clubName} ya tenía este teléfono. No se creó otra ficha.`
            : `${state.clubName ?? clubName} ya puede verte en jugadores.`}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-background p-4 sm:p-6">
      <input type="hidden" name="clubSlug" value={clubSlug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="firstName">
          <Input id="firstName" name="firstName" required maxLength={60} autoComplete="given-name" />
        </Field>
        <Field label="Apellido" htmlFor="lastName">
          <Input id="lastName" name="lastName" required maxLength={60} autoComplete="family-name" />
        </Field>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phoneLocal">Teléfono</Label>
        <div className="flex gap-2">
          <select
            name="phoneCountryDial"
            defaultValue={DEFAULT_PHONE_DIAL}
            className={cn(SELECT_CLASS, "w-[6.5rem] shrink-0")}
            aria-label="País del teléfono"
          >
            {PHONE_COUNTRIES.map((country) => (
              <option key={country.iso} value={country.dial}>
                {country.flag} +{country.dial}
              </option>
            ))}
          </select>
          <Input
            id="phoneLocal"
            name="phoneLocal"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="11 2345 6789"
            required
            maxLength={20}
            className="min-w-0 flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Sin 0 ni 15. Ej: 11 2345 6789 — se guarda listo para WhatsApp.
        </p>
      </div>

      <Field label="Categoría" htmlFor="category">
        <select
          id="category"
          name="category"
          defaultValue=""
          required={categories.length > 0}
          className={SELECT_CLASS}
        >
          <option value="">Elegí tu categoría</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Email" htmlFor="email" hint="Opcional">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={120}
        />
      </Field>

      <Field label="Instagram" htmlFor="instagram" hint="Opcional">
        <Input
          id="instagram"
          name="instagram"
          placeholder="@usuario"
          autoComplete="off"
          maxLength={80}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sexo" htmlFor="gender" hint="Opcional">
          <select id="gender" name="gender" defaultValue="" className={SELECT_CLASS}>
            <option value="">—</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {GENDER_LABELS[gender]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Localidad" htmlFor="city" hint="Opcional">
          <Input id="city" name="city" maxLength={80} autoComplete="address-level2" />
        </Field>
      </div>

      <Field label="Posición en cancha" htmlFor="courtPosition" hint="Opcional">
        <select
          id="courtPosition"
          name="courtPosition"
          defaultValue=""
          className={SELECT_CLASS}
        >
          <option value="">—</option>
          {COURT_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {COURT_POSITION_LABELS[position]}
            </option>
          ))}
        </select>
      </Field>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Guardando…" : "Darme de alta"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
