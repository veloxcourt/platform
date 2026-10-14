"use server";

import { registerPublicPlayer } from "@/modules/players/application/register-public-player";

export type PublicSignupState = {
  ok?: true;
  already?: boolean;
  clubName?: string;
  error?: string;
};

export async function submitPublicPlayerSignupAction(
  _previous: PublicSignupState,
  formData: FormData,
): Promise<PublicSignupState> {
  const result = await registerPublicPlayer({
    clubSlug: String(formData.get("clubSlug") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phoneCountryDial: String(formData.get("phoneCountryDial") ?? ""),
    phoneLocal: String(formData.get("phoneLocal") ?? ""),
    email: String(formData.get("email") ?? ""),
    instagram: String(formData.get("instagram") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    city: "",
    catalogCityId: String(formData.get("catalogCityId") ?? ""),
    category: String(formData.get("category") ?? ""),
    courtPosition: String(formData.get("courtPosition") ?? ""),
  });

  if (!result.ok) return { error: result.error };
  return { ok: true, already: result.already, clubName: result.clubName };
}
