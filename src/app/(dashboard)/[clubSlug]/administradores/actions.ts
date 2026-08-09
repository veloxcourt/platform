"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireClubPrivilege } from "@/lib/auth/access";
import { ensureClubUserTypes } from "@/lib/auth/user-types";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminSchema,
  adminTypeSchema,
} from "@/modules/admins/domain/admin-schema";

type ActionResult =
  | { ok: true; invited?: boolean; message?: string }
  | { ok: false; error: string };

async function invitationRedirectUrl() {
  const requestHeaders = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    requestHeaders.get("origin") ??
    "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/auth/confirm`;
}

async function resolveAssignableType(clubId: string, userTypeId: string) {
  return prisma.clubUserType.findFirst({
    where: { id: userTypeId, clubId, active: true },
  });
}

export async function inviteAdministratorAction(
  clubSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "usuarios");
  await ensureClubUserTypes(access.club.id);

  const parsed = adminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { email, fullName, userTypeId } = parsed.data;
  const userType = await resolveAssignableType(access.club.id, userTypeId);
  if (!userType) return { ok: false, error: "Tipo de usuario inválido." };

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  const existingMembership = existingUser
    ? await prisma.membership.findFirst({
        where: {
          clubId: access.club.id,
          userId: existingUser.id,
          role: { in: ["OWNER", "CLUB_ADMIN"] },
        },
      })
    : null;

  if (existingMembership?.staffStatus !== "DISABLED") {
    if (existingMembership) {
      return { ok: false, error: "Ese email ya está cargado en el club." };
    }
  }

  let authUserId = existingUser?.authUserId ?? null;
  let status: "ACTIVE" | "INVITED" = authUserId ? "ACTIVE" : "INVITED";

  if (!authUserId) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        ok: false,
        error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY para enviar invitaciones.",
      };
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, club_slug: clubSlug },
      redirectTo: await invitationRedirectUrl(),
    });

    if (error || !data.user) {
      return {
        ok: false,
        error: error?.message ?? "No se pudo enviar la invitación.",
      };
    }
    authUserId = data.user.id;
    status = "INVITED";
  }

  await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: { fullName, email, authUserId },
        })
      : await tx.user.create({
          data: { fullName, email, authUserId },
        });

    if (existingMembership) {
      await tx.membership.update({
        where: { id: existingMembership.id },
        data: {
          userTypeId: userType.id,
          allowedModules: userType.privileges,
          staffStatus: status,
          invitedAt: new Date(),
          acceptedAt: status === "ACTIVE" ? new Date() : null,
          disabledAt: null,
        },
      });
      return;
    }

    await tx.membership.create({
      data: {
        clubId: access.club.id,
        userId: user.id,
        role: "CLUB_ADMIN",
        userTypeId: userType.id,
        allowedModules: userType.privileges,
        staffStatus: status,
        invitedAt: new Date(),
        acceptedAt: status === "ACTIVE" ? new Date() : null,
      },
    });
  });

  revalidatePath(`/${clubSlug}/administradores`);

  if (status === "ACTIVE") {
    return {
      ok: true,
      invited: false,
      message:
        "Usuario agregado al club. Ya tenía cuenta, puede ingresar con su email y contraseña habituales.",
    };
  }

  return {
    ok: true,
    invited: true,
    message: "Invitación enviada por email.",
  };
}

export async function updateAdministratorTypeAction(
  clubSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "usuarios");
  const parsed = adminTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const userType = await resolveAssignableType(
    access.club.id,
    parsed.data.userTypeId,
  );
  if (!userType) return { ok: false, error: "Tipo de usuario inválido." };

  const result = await prisma.membership.updateMany({
    where: {
      id: parsed.data.membershipId,
      clubId: access.club.id,
      role: "CLUB_ADMIN",
      staffStatus: { not: "DISABLED" },
    },
    data: {
      userTypeId: userType.id,
      allowedModules: userType.privileges,
    },
  });

  if (result.count !== 1) {
    return { ok: false, error: "No se encontró el usuario." };
  }

  revalidatePath(`/${clubSlug}/administradores`);
  return { ok: true };
}

export async function disableAdministratorAction(
  clubSlug: string,
  membershipId: string,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "usuarios");
  const result = await prisma.membership.updateMany({
    where: {
      id: membershipId,
      clubId: access.club.id,
      role: "CLUB_ADMIN",
    },
    data: { staffStatus: "DISABLED", disabledAt: new Date() },
  });

  if (result.count !== 1) {
    return { ok: false, error: "No se encontró el usuario." };
  }

  revalidatePath(`/${clubSlug}/administradores`);
  return { ok: true };
}

export async function resendAdministratorInviteAction(
  clubSlug: string,
  membershipId: string,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "usuarios");
  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      clubId: access.club.id,
      role: "CLUB_ADMIN",
      staffStatus: "INVITED",
    },
    include: { user: true },
  });

  if (!membership?.user.email) {
    return { ok: false, error: "No se encontró una invitación pendiente." };
  }

  const supabase = createSupabaseAdminClient();
  if (membership.user.authUserId) {
    const { data: existing } = await supabase.auth.admin.getUserById(
      membership.user.authUserId,
    );
    if (existing.user?.email_confirmed_at) {
      const { error: recoveryError } =
        await supabase.auth.resetPasswordForEmail(membership.user.email, {
          redirectTo: await invitationRedirectUrl(),
        });
      if (recoveryError) return { ok: false, error: recoveryError.message };
      await prisma.membership.update({
        where: { id: membership.id },
        data: { invitedAt: new Date() },
      });
      revalidatePath(`/${clubSlug}/administradores`);
      return { ok: true };
    }
    if (existing.user && !existing.user.last_sign_in_at) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        existing.user.id,
      );
      if (deleteError) return { ok: false, error: deleteError.message };
    }
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    membership.user.email,
    {
      data: { full_name: membership.user.fullName, club_slug: clubSlug },
      redirectTo: await invitationRedirectUrl(),
    },
  );
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "No se pudo reenviar." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: membership.userId },
      data: { authUserId: data.user.id },
    }),
    prisma.membership.update({
      where: { id: membership.id },
      data: { invitedAt: new Date() },
    }),
  ]);
  revalidatePath(`/${clubSlug}/administradores`);
  return { ok: true };
}
