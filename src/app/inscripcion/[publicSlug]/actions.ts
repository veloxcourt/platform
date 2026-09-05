"use server";

import { registerPublicPair } from "@/modules/tournaments/application/register-public-pair";

export type PublicInscriptionState = { ok?: true; error?: string };

export async function submitPublicInscriptionAction(
  _previous: PublicInscriptionState,
  formData: FormData,
): Promise<PublicInscriptionState> {
  const result = await registerPublicPair({
    publicSlug: String(formData.get("publicSlug") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    player1: {
      firstName: String(formData.get("player1FirstName") ?? ""),
      lastName: String(formData.get("player1LastName") ?? ""),
      phone: String(formData.get("player1Phone") ?? ""),
      gender: String(formData.get("player1Gender") ?? ""),
    },
    player2: {
      firstName: String(formData.get("player2FirstName") ?? ""),
      lastName: String(formData.get("player2LastName") ?? ""),
      phone: String(formData.get("player2Phone") ?? ""),
      gender: String(formData.get("player2Gender") ?? ""),
    },
  });
  return result.ok ? { ok: true } : { error: result.error };
}
