"use server";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ConfirmResult = { ok: true } | { ok: false; error: string };

export async function activateInvitationAction(): Promise<ConfirmResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser?.email) {
    return { ok: false, error: "No se pudo validar la invitación." };
  }

  const email = authUser.email.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { authUserId: authUser.id },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
  });

  if (!user) {
    await supabase.auth.signOut();
    return { ok: false, error: "La cuenta no tiene acceso a ningún club." };
  }
  if (user.authUserId && user.authUserId !== authUser.id) {
    await supabase.auth.signOut();
    return { ok: false, error: "La invitación no corresponde a esta cuenta." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { authUserId: authUser.id, email },
    }),
    prisma.membership.updateMany({
      where: {
        userId: user.id,
        role: "CLUB_ADMIN",
        staffStatus: "INVITED",
      },
      data: {
        staffStatus: "ACTIVE",
        acceptedAt: new Date(),
        disabledAt: null,
      },
    }),
  ]);

  return { ok: true };
}
