"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { activateInvitationAction } from "./actions";

export default function ConfirmInvitationPage() {
  const started = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Validando tu invitación…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    async function confirm() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const hashError = hash.get("error_description");
      if (hashError) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            hash.get("error_code") === "otp_expired"
              ? "La invitación venció o ya fue utilizada. Solicitá una nueva."
              : hashError.replaceAll("+", " "),
          );
        }
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          if (!cancelled) {
            setStatus("error");
            setMessage("No se pudo iniciar la sesión de la invitación.");
          }
          return;
        }
      }

      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) {
            setStatus("error");
            setMessage("No se pudo validar el enlace de invitación.");
          }
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setStatus("error");
          setMessage("El enlace de invitación no contiene una sesión válida.");
        }
        return;
      }

      const result = await activateInvitationAction();
      if (cancelled) return;
      if (!result.ok) {
        setStatus("error");
        setMessage(result.error);
        return;
      }

      window.history.replaceState({}, "", "/auth/confirm");
      setStatus("ready");
      setMessage("Invitación aceptada. Ahora creá tu contraseña.");
    }

    void confirm();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-muted">
            {status === "loading" ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : status === "ready" ? (
              <CheckCircle2 className="size-5 text-green-600" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
          </span>
          <CardTitle>Invitación a VeloxCourt</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "ready" ? (
            <Button className="w-full" onClick={() => location.assign("/set-password")}>
              Crear contraseña
            </Button>
          ) : status === "error" ? (
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Volver al ingreso
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
