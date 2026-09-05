"use client";

import { useActionState } from "react";

import { submitPublicInscriptionAction } from "@/app/inscripcion/[publicSlug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENDER_LABELS, GENDERS } from "@/modules/bookings/domain/new-player-schema";

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function PlayerFields({ prefix, title }: { prefix: "player1" | "player2"; title: string }) {
  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}FirstName`}>Nombre</Label>
          <Input id={`${prefix}FirstName`} name={`${prefix}FirstName`} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}LastName`}>Apellido</Label>
          <Input id={`${prefix}LastName`} name={`${prefix}LastName`} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}Phone`}>Teléfono</Label>
          <Input
            id={`${prefix}Phone`}
            name={`${prefix}Phone`}
            inputMode="tel"
            placeholder="11 2345 6789"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}Gender`}>Género</Label>
          <select id={`${prefix}Gender`} name={`${prefix}Gender`} required className={SELECT_CLASS}>
            <option value="">Elegí…</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {GENDER_LABELS[gender]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

export function PublicInscriptionForm({
  publicSlug,
  categories,
}: {
  publicSlug: string;
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(submitPublicInscriptionAction, {});

  if (state.ok) {
    return (
      <div className="rounded-xl border bg-background p-6 text-sm">
        <p className="font-medium">Inscripción enviada</p>
        <p className="mt-2 text-muted-foreground">
          El club va a confirmar la pareja. Si hace falta, te van a contactar.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="publicSlug" value={publicSlug} />
      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Categoría</Label>
        <select
          id="categoryId"
          name="categoryId"
          required
          className={SELECT_CLASS}
          defaultValue={categories.length === 1 ? categories[0]!.id : ""}
        >
          {categories.length !== 1 ? <option value="">Elegí…</option> : null}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <PlayerFields prefix="player1" title="Jugador 1" />
      <PlayerFields prefix="player2" title="Jugador 2" />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Enviando…" : "Inscribir pareja"}
      </Button>
    </form>
  );
}
