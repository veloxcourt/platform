import { revalidatePath } from "next/cache";

import { DEFAULT_PHONE_DIAL, normalizeToE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import type { Gender } from "@/modules/bookings/domain/new-player-schema";
import {
  isPlayerEligibleForCategory,
  parseCategoryGenderFromName,
} from "@/modules/tournaments/domain/category-player-filter";
import {
  publicInscriptionSchema,
  type PublicInscriptionValues,
} from "@/modules/tournaments/domain/public-inscription-schema";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

type PlayerInput = PublicInscriptionValues["player1"];

async function ensureClubPlayer(
  clubId: string,
  input: PlayerInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const phone = normalizeToE164(input.phone, DEFAULT_PHONE_DIAL);
  if (!phone) return { ok: false, error: "Teléfono inválido." };

  const existing = await prisma.user.findFirst({
    where: {
      phone,
      memberships: { some: { clubId } },
    },
    select: { id: true, gender: true },
  });

  if (existing) {
    if (!existing.gender) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { gender: input.gender },
      });
    }
    return { ok: true, id: existing.id };
  }

  const user = await prisma.user.create({
    data: {
      fullName: `${input.firstName} ${input.lastName}`.trim(),
      firstName: input.firstName,
      lastName: input.lastName,
      phone,
      gender: input.gender,
      memberships: { create: { clubId, role: "PLAYER" } },
    },
    select: { id: true },
  });
  return { ok: true, id: user.id };
}

export async function registerPublicPair(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = publicInscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const tournament = await prisma.tournament.findFirst({
    where: { publicSlug: parsed.data.publicSlug },
    include: {
      club: { select: { id: true, slug: true } },
      categories: {
        where: { id: parsed.data.categoryId },
        select: { id: true, name: true },
      },
    },
  });
  if (!tournament) return { ok: false, error: "Torneo no encontrado." };
  if (tournament.type !== "ZONAS") {
    return { ok: false, error: "Este torneo no admite inscripción pública todavía." };
  }
  if (tournament.status === "CLOSED" || tournament.status === "FINISHED") {
    return { ok: false, error: "Las inscripciones de este torneo están cerradas." };
  }

  const category = tournament.categories[0];
  if (!category) return { ok: false, error: "Elegí una categoría válida." };

  const player1 = await ensureClubPlayer(tournament.clubId, parsed.data.player1);
  if (!player1.ok) return player1;
  const player2 = await ensureClubPlayer(tournament.clubId, parsed.data.player2);
  if (!player2.ok) return player2;
  if (player1.id === player2.id) {
    return { ok: false, error: "Los dos jugadores deben ser distintos." };
  }

  const categoryGender = parseCategoryGenderFromName(category.name);
  if (categoryGender) {
    for (const [player, source] of [
      [player1, parsed.data.player1],
      [player2, parsed.data.player2],
    ] as const) {
      if (
        !isPlayerEligibleForCategory(
          {
            id: player.id,
            name: `${source.firstName} ${source.lastName}`,
            gender: source.gender as Gender,
          },
          categoryGender,
        )
      ) {
        return {
          ok: false,
          error: `${source.firstName} no corresponde al género de ${category.name}.`,
        };
      }
    }
  }

  const repo = getTournamentRepository();
  const result = await repo.addPair(tournament.clubId, tournament.id, {
    categoryId: category.id,
    player1Id: player1.id,
    player2Id: player2.id,
  });
  if (!result.ok) return { ok: false, error: result.error };

  if (parsed.data.slots.length > 0) {
    const prefs = await repo.replacePairSlotPreferences(
      tournament.clubId,
      tournament.id,
      result.id,
      { slots: parsed.data.slots },
    );
    if (!prefs.ok) {
      console.error("[public-inscription] slot preferences", prefs.error);
    }
  }

  if (parsed.data.zonesDayPreference !== "ANY") {
    const prefs = await repo.updatePairZonesDayPreference(
      tournament.clubId,
      tournament.id,
      result.id,
      parsed.data.zonesDayPreference,
    );
    if (!prefs.ok) {
      console.error("[public-inscription] day preference", prefs.error);
    }
  }

  revalidatePath(`/${tournament.club.slug}/torneos`);
  revalidatePath(`/${tournament.club.slug}/torneos/${tournament.id}`);
  revalidatePath(`/inscripcion/${tournament.publicSlug}`);
  return { ok: true };
}
