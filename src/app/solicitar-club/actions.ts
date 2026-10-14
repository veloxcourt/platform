"use server";

import { prisma } from "@/lib/prisma";
import { catalogCityAssignment } from "@/modules/cities/application/city-catalog";
import { clubRequestSchema } from "@/modules/platform/domain/club-request-schema";

export type ClubRequestState = { ok?: true; error?: string };

export async function submitClubRequestAction(
  _previous: ClubRequestState,
  formData: FormData,
): Promise<ClubRequestState> {
  const parsed = clubRequestSchema.safeParse({
    clubName: formData.get("clubName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    catalogCityId: formData.get("catalogCityId"),
    locality: "",
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario.",
    };
  }

  const located = await catalogCityAssignment(parsed.data.catalogCityId);
  if (!located.ok || !located.name || !located.catalogCityId) {
    return { error: located.ok ? "Elegí la localidad." : located.error };
  }

  await prisma.clubRequest.create({
    data: {
      clubName: parsed.data.clubName,
      contactName: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      locality: located.name,
      catalogCityId: located.catalogCityId,
      message: parsed.data.message?.trim() || null,
    },
  });

  return { ok: true };
}
