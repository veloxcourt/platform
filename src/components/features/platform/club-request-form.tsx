"use client";

import { useActionState } from "react";

import { submitClubRequestAction } from "@/app/solicitar-club/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClubRequestForm() {
  const [state, action, pending] = useActionState(submitClubRequestAction, {});

  if (state.ok) {
    return (
      <div className="rounded-xl border bg-background/80 p-6 text-sm">
        <p className="font-medium">Solicitud enviada</p>
        <p className="mt-2 text-muted-foreground">
          Gracias. Revisaremos tus datos y te contactaremos para crear el club.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-background/80 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="clubName">Nombre del club</Label>
          <Input id="clubName" name="clubName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Nombre del interesado</Label>
          <Input id="contactName" name="contactName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="locality">Localidad</Label>
          <Input id="locality" name="locality" required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="message">Mensaje</Label>
          <textarea
            id="message"
            name="message"
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Contanos brevemente tu club o lo que necesitás"
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
