"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { finishAuthLinkAction } from "./actions";

const CONFIRM_ERRORS: Record<string, string> = {
  invalid: "No se pudo validar el enlace.",
  "no-club": "La cuenta no tiene acceso a ningún club.",
  mismatch: "El enlace no corresponde a esta cuenta.",
};

type ConfirmStatus = {
  status: "ready" | "error" | "redirecting";
  isRecovery: boolean;
  message: string;
  nextPath?: string;
};

let confirmJob: Promise<ConfirmStatus> | null = null;

function confirmAuthLink(): Promise<ConfirmStatus> {
  if (!confirmJob) confirmJob = confirmAuthLinkOnce();
  return confirmJob;
}

async function confirmAuthLinkOnce(): Promise<ConfirmStatus> {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  let storedIntent = "";
  try {
    storedIntent = sessionStorage.getItem("velox-auth-intent") ?? "";
    sessionStorage.removeItem("velox-auth-intent");
  } catch {
    storedIntent = "";
  }
  const recovery =
    storedIntent === "recovery" ||
    url.searchParams.get("from") === "recovery" ||
    hash.get("type") === "recovery" ||
    url.searchParams.get("type") === "recovery";
  const nextPath = recovery ? "/set-password?from=recovery" : "/set-password";

  const queryError = url.searchParams.get("error");
  if (queryError) {
    return {
      status: "error",
      isRecovery: recovery,
      message:
        CONFIRM_ERRORS[queryError] ??
        queryError.replaceAll("+", " "),
    };
  }

  const hashError = hash.get("error_description");
  if (hashError) {
    return {
      status: "error",
      isRecovery: recovery,
      message:
        hash.get("error_code") === "otp_expired"
          ? "El enlace venció o ya fue utilizado. Solicitá uno nuevo."
          : hashError.replaceAll("+", " "),
    };
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  if (code || tokenHash) {
    window.location.replace(`/auth/callback${url.search}`);
    return {
      status: "redirecting",
      isRecovery: recovery,
      message: "Validando el enlace…",
    };
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
      return {
        status: "error",
        isRecovery: recovery,
        message: "No se pudo iniciar la sesión del enlace.",
      };
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return {
      status: "error",
      isRecovery: recovery,
      message: "El enlace no contiene una sesión válida.",
    };
  }

  const result = await finishAuthLinkAction(recovery ? "recovery" : "invite");
  if (!result.ok) {
    return { status: "error", isRecovery: recovery, message: result.error };
  }

  window.history.replaceState(
    {},
    "",
    recovery ? "/auth/confirm?from=recovery" : "/auth/confirm",
  );
  return {
    status: "ready",
    isRecovery: recovery,
    message: recovery
      ? "Enlace válido. Ahora creá tu contraseña nueva."
      : "Invitación aceptada. Ahora creá tu contraseña.",
    nextPath,
  };
}

export default function ConfirmLinkPage({
  from,
  error,
}: {
  from?: string;
  error?: string;
}) {
  const recoveryFromServer = from === "recovery";
  const presetError = error
    ? (CONFIRM_ERRORS[error] ?? error.replaceAll("+", " "))
    : null;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    presetError ? "error" : "loading",
  );
  const [isRecovery, setIsRecovery] = useState(recoveryFromServer);
  const [message, setMessage] = useState(presetError ?? "Validando el enlace…");

  useEffect(() => {
    if (presetError) return;
    let cancelled = false;
    void confirmAuthLink().then((result) => {
      if (cancelled) return;
      setIsRecovery(result.isRecovery);
      if (result.status === "redirecting") return;
      setStatus(result.status);
      setMessage(result.message);
      if (result.status === "ready" && result.nextPath) {
        window.location.replace(result.nextPath);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [presetError]);

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
          <CardTitle>
            {isRecovery ? "Recuperar contraseña" : "Invitación a VeloxCourt"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "ready" ? (
            <Button
              className="w-full"
              onClick={() =>
                location.assign(
                  isRecovery ? "/set-password?from=recovery" : "/set-password",
                )
              }
            >
              {isRecovery ? "Crear contraseña nueva" : "Crear contraseña"}
            </Button>
          ) : status === "error" ? (
            <Link
              href={isRecovery ? "/forgot-password" : "/login"}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              {isRecovery ? "Solicitar un enlace nuevo" : "Volver al ingreso"}
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
