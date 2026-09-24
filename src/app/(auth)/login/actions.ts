"use server";

import { redirect } from "next/navigation";

import { firstDestinationModule } from "@/lib/auth/permissions";
import { clearPasswordResetRequired } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "").trim() || null);

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

  let user = await prisma.user.findFirst({
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

  if (!user) {
    user = await prisma.user.create({
      data: {
        authUserId: data.user.id,
        email,
        fullName: data.user.user_metadata?.full_name ?? email,
      },
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
  } else if (!user.authUserId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { authUserId: data.user.id },
    });
  }

  const staffMembership = user.memberships[0];
  if (staffMembership) {
    if (next) redirect(next);
    const privileges =
      staffMembership.userType?.privileges ?? staffMembership.allowedModules;
    const destinationModule = firstDestinationModule(
      privileges,
      staffMembership.role,
    );
    redirect(`/${staffMembership.club.slug}/${destinationModule}`);
  }

  redirect(next ?? "/cuenta");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await clearPasswordResetRequired();
  await supabase.auth.signOut();
  redirect("/login");
}
