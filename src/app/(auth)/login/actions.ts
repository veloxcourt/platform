"use server";

import { redirect } from "next/navigation";

import { firstDestinationModule } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresá tu email y contraseña." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Email o contraseña incorrectos." };
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ authUserId: data.user.id }, { email }] },
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

  if (!user || user.memberships.length === 0) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no tiene acceso a ningún club." };
  }

  if (!user.authUserId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { authUserId: data.user.id },
    });
  }

  const membership = user.memberships[0];
  const privileges =
    membership.userType?.privileges ?? membership.allowedModules;
  const destinationModule = firstDestinationModule(
    privileges,
    membership.role,
  );
  redirect(`/${membership.club.slug}/${destinationModule}`);
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
