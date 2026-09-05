"use server";

import { revalidatePath } from "next/cache";

import { requireClubPrivilege } from "@/lib/auth/access";
import { ensureRuntimeSchema, prisma } from "@/lib/prisma";
import { improvementSchema } from "@/modules/improvements/domain/schema";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate(clubSlug: string) {
  revalidatePath(`/${clubSlug}/que-mejoro`);
}

export async function createImprovementAction(
  clubSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "que-mejoro");
  const parsed = improvementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const last = await prisma.clubImprovement.findFirst({
    where: { clubId: access.club.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.clubImprovement.create({
    data: {
      clubId: access.club.id,
      title: parsed.data.title,
      detail: parsed.data.detail?.trim() || null,
      kind: parsed.data.kind,
      status: parsed.data.status,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidate(clubSlug);
  return { ok: true };
}

export async function updateImprovementAction(
  clubSlug: string,
  improvementId: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "que-mejoro");
  const parsed = improvementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const result = await prisma.clubImprovement.updateMany({
    where: { id: improvementId, clubId: access.club.id },
    data: {
      title: parsed.data.title,
      detail: parsed.data.detail?.trim() || null,
      kind: parsed.data.kind,
      status: parsed.data.status,
    },
  });
  if (result.count !== 1) return { ok: false, error: "Ítem no encontrado." };

  revalidate(clubSlug);
  return { ok: true };
}

export async function updateImprovementStatusAction(
  clubSlug: string,
  improvementId: string,
  status: unknown,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "que-mejoro");
  const parsed = improvementSchema.shape.status.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Estado inválido." };

  const result = await prisma.clubImprovement.updateMany({
    where: { id: improvementId, clubId: access.club.id },
    data: { status: parsed.data },
  });
  if (result.count !== 1) return { ok: false, error: "Ítem no encontrado." };

  revalidate(clubSlug);
  return { ok: true };
}

export async function deleteImprovementAction(
  clubSlug: string,
  improvementId: string,
): Promise<ActionResult> {
  const access = await requireClubPrivilege(clubSlug, "que-mejoro");
  const result = await prisma.clubImprovement.deleteMany({
    where: { id: improvementId, clubId: access.club.id },
  });
  if (result.count !== 1) return { ok: false, error: "Ítem no encontrado." };

  revalidate(clubSlug);
  return { ok: true };
}
