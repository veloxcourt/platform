"use server";

import { revalidatePath } from "next/cache";

import { NAV_TAB_IDS } from "@/config/modules";
import { requireClubAccess } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveNavOrderAction(
  clubSlug: string,
  order: string[],
): Promise<ActionResult> {
  const access = await requireClubAccess(clubSlug);

  const allowed = new Set<string>(NAV_TAB_IDS);
  const cleaned = order.filter((id) => allowed.has(id));
  if (cleaned.length === 0) {
    return { ok: false, error: "Orden inválido." };
  }

  await prisma.membership.update({
    where: { id: access.membershipId },
    data: { navOrder: cleaned },
  });

  revalidatePath(`/${clubSlug}`, "layout");
  return { ok: true };
}
