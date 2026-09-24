"use server";

import { linkAuthUserToLocalAccount } from "@/lib/auth/complete-email-link";
import { markPasswordResetRequired } from "@/lib/auth/password-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ConfirmResult = { ok: true } | { ok: false; error: string };

export async function finishAuthLinkAction(
  mode: "invite" | "recovery",
): Promise<ConfirmResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser?.email) {
    return { ok: false, error: "No se pudo validar el enlace." };
  }

  const result = await linkAuthUserToLocalAccount(
    { id: authUser.id, email: authUser.email },
    { activateInvites: mode === "invite" },
  );
  if (!result.ok) {
    if (result.signOut) await supabase.auth.signOut();
    return { ok: false, error: result.error };
  }

  await markPasswordResetRequired();
  return { ok: true };
}

export async function activateInvitationAction(): Promise<ConfirmResult> {
  return finishAuthLinkAction("invite");
}
