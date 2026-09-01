"use server";

import { revalidatePath } from "next/cache";

import { requireClubPrivilege } from "@/lib/auth/access";
import { toDatabaseModules } from "@/lib/auth/permissions";
import { ensureClubUserTypes } from "@/lib/auth/user-types";
import { applyPrivilegeToggle, type AdminModuleKey } from "@/config/modules";
import { prisma } from "@/lib/prisma";
import { userTypeSchema } from "@/modules/admins/domain/user-type-schema";

type ActionResult = { ok: true } | { ok: false; error: string };

function normalizePrivileges(privileges: AdminModuleKey[]) {
  return privileges.includes("catalogo")
    ? applyPrivilegeToggle(privileges, "catalogo", true)
    : privileges;
}

function revalidate(clubSlug: string) {
  revalidatePath(`/${clubSlug}/control-usuarios/tipo-usuario`);
  revalidatePath(`/${clubSlug}/control-usuarios/usuarios`);
}

export async function createUserTypeAction(
  clubSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "tipos-usuario");
  await ensureClubUserTypes(access.club.id);

  const parsed = userTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const name = parsed.data.name.trim();
  const exists = await prisma.clubUserType.findUnique({
    where: { clubId_name: { clubId: access.club.id, name } },
  });
  if (exists) return { ok: false, error: "Ya existe un tipo con ese nombre." };

  await prisma.clubUserType.create({
    data: {
      clubId: access.club.id,
      name,
      description: parsed.data.description?.trim() || null,
      privileges: toDatabaseModules(normalizePrivileges(parsed.data.privileges)),
      active: parsed.data.active,
    },
  });

  revalidate(clubSlug);
  return { ok: true };
}

export async function updateUserTypeAction(
  clubSlug: string,
  userTypeId: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "tipos-usuario");
  const parsed = userTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const name = parsed.data.name.trim();
  const duplicate = await prisma.clubUserType.findFirst({
    where: {
      clubId: access.club.id,
      name,
      NOT: { id: userTypeId },
    },
  });
  if (duplicate) return { ok: false, error: "Ya existe un tipo con ese nombre." };

  const result = await prisma.clubUserType.updateMany({
    where: { id: userTypeId, clubId: access.club.id },
    data: {
      name,
      description: parsed.data.description?.trim() || null,
      privileges: toDatabaseModules(normalizePrivileges(parsed.data.privileges)),
      active: parsed.data.active,
    },
  });
  if (result.count !== 1) return { ok: false, error: "Tipo no encontrado." };

  revalidate(clubSlug);
  return { ok: true };
}

export async function deleteUserTypeAction(
  clubSlug: string,
  userTypeId: string,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "tipos-usuario");

  const type = await prisma.clubUserType.findFirst({
    where: { id: userTypeId, clubId: access.club.id },
    include: { _count: { select: { memberships: true } } },
  });
  if (!type) return { ok: false, error: "Tipo no encontrado." };
  if (type._count.memberships > 0) {
    return {
      ok: false,
      error: "No se puede eliminar: hay usuarios asignados a este tipo.",
    };
  }

  await prisma.clubUserType.delete({ where: { id: type.id } });
  revalidate(clubSlug);
  return { ok: true };
}
