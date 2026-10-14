"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth/superadmin";
import { prisma } from "@/lib/prisma";
import { createClub } from "@/modules/platform/application/create-club";
import { createClubSchema } from "@/modules/platform/domain/create-club-schema";
import {
  markCityReviewed,
  mergeCatalogCities,
} from "@/modules/cities/application/manage-cities";
import { mergeCitiesSchema } from "@/modules/cities/domain/city";

type ActionResult = { ok: true; slug?: string } | { ok: false; error: string };

export async function createClubAction(
  input: unknown,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = createClubSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const result = await createClub(parsed.data);
  if (!result.ok) return result;

  revalidatePath("/superadmin");
  return { ok: true, slug: result.slug };
}

export async function rejectClubRequestAction(
  requestId: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const result = await prisma.clubRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  if (result.count !== 1) {
    return { ok: false, error: "Solicitud no encontrada." };
  }
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function mergeCitiesAction(
  sourceId: string,
  targetId: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = mergeCitiesSchema.safeParse({ sourceId, targetId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const result = await mergeCatalogCities(parsed.data.sourceId, parsed.data.targetId);
  if (!result.ok) return result;
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function reviewCityAction(cityId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const result = await markCityReviewed(cityId);
  if (!result.ok) return result;
  revalidatePath("/superadmin");
  return { ok: true };
}
