"use server";

import { redirect } from "next/navigation";

import { firstDestinationModule } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string };

export async function setPasswordAction(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmation) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No se pudo guardar la contraseña." };

  const localUser = await prisma.user.findUnique({
    where: { authUserId: user.id },
    include: {
      memberships: {
        where: {
          OR: [
            { role: "OWNER" },
            { role: "CLUB_ADMIN", staffStatus: "ACTIVE" },
          ],
        },
        include: {
          club: { select: { slug: true } },
          userType: { select: { privileges: true } },
        },
        take: 1,
      },
    },
  });

  const membership = localUser?.memberships[0];
  if (!membership) redirect("/login");
  const privileges =
    membership.userType?.privileges ?? membership.allowedModules;
  const destinationModule = firstDestinationModule(
    privileges,
    membership.role,
  );
  redirect(`/${membership.club.slug}/${destinationModule}`);
}
