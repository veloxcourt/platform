"use server";

import { prisma } from "@/lib/prisma";
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
    locality: formData.get("locality"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario.",
    };
  }

  await prisma.clubRequest.create({
    data: {
      clubName: parsed.data.clubName,
      contactName: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      locality: parsed.data.locality,
      message: parsed.data.message?.trim() || null,
    },
  });

  return { ok: true };
}
