"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { forgotPasswordAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});

  if (state.sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Si el email está registrado, vas a recibir un enlace para crear una
          contraseña nueva. Revisá Recibidos y Spam. Usá el mail más reciente
          y no vuelvas a pedir otro: varios envíos seguidos se bloquean.
        </p>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Volver al ingreso
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={() => {
        try {
          sessionStorage.setItem("velox-auth-intent", "recovery");
        } catch {
          // ignore
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
      <Link
        href="/login"
        className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Volver al ingreso
      </Link>
    </form>
  );
}
