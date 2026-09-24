"use server";

import { createClient } from "@supabase/supabase-js";

import { authConfirmUrl } from "@/lib/auth/app-origin";

export type ForgotPasswordState = { error?: string; sent?: boolean };

async function recoveryRedirectUrl() {
  return authConfirmUrl("recovery");
}

function isRateLimitError(error: {
  message?: string;
  code?: string;
  status?: number;
}) {
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  return (
    error.status === 429 ||
    code.includes("rate_limit") ||
    code.includes("over_email") ||
    message.includes("rate limit") ||
    message.includes("only request this after")
  );
}

export async function forgotPasswordAction(
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { error: "Ingresá un email válido." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { error: "Falta la configuración de autenticación." };
  }

  // Cliente sin cookies de sesión: un refresh token viejo no puede bloquear el mail.
  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: await recoveryRedirectUrl(),
    });

    if (error) {
      console.error("[forgot-password]", error.code, error.status, error.message);
      if (isRateLimitError(error)) {
        return {
          error:
            "Supabase bloqueó los envíos por pedir varios enlaces seguidos. Usá el último mail que recibiste o esperá una hora.",
        };
      }
      return {
        error:
          "No se pudo enviar el enlace. Revisá el email e intentá de nuevo en un minuto.",
      };
    }
  } catch (error) {
    console.error("[forgot-password]", error);
    return {
      error:
        "No se pudo enviar el enlace. Revisá la conexión e intentá de nuevo.",
    };
  }

  return { sent: true };
}
