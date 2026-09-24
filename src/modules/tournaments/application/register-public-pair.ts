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
import {
  createManageToken,
  findPublicPairByManageToken,
  pairManagePath,
} from "@/modules/tournaments/application/find-public-pair";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

type PlayerInput = PublicInscriptionValues["player1"];

async function ensureClubPlayer(
  clubId: string,
  input: PlayerInput,
  options?: { forceUserId?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (options?.forceUserId) {
    const existing = await prisma.user.findFirst({
      where: { id: options.forceUserId },
      select: { id: true, gender: true, phone: true, city: true },
    });
    if (!existing) return { ok: false, error: "Usuario no encontrado." };

    const membership = await prisma.membership.findFirst({
      where: { clubId, userId: existing.id, role: "PLAYER" },
      select: { id: true },
    });
    if (!membership) {
      await prisma.membership.create({
        data: { clubId, userId: existing.id, role: "PLAYER" },
      });
    }

    const phone = input.phone
      ? normalizeToE164(input.phone, DEFAULT_PHONE_DIAL)
      : null;
    const city = input.city.trim();
    const patch: {
      gender?: typeof input.gender;
      phone?: string;
      city?: string;
    } = {};
    if (!existing.gender && input.gender) patch.gender = input.gender;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.city && city) patch.city = city;
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({ where: { id: existing.id }, data: patch });
    }
    return { ok: true, id: existing.id };
  }

  const phone = normalizeToE164(input.phone, DEFAULT_PHONE_DIAL);
  if (!phone) return { ok: false, error: "Teléfono inválido." };

  const existing = await prisma.user.findFirst({
    where: {
      phone,
      memberships: { some: { clubId } },
    },
    select: { id: true, gender: true, city: true },
  });

  if (existing) {
    const city = input.city.trim();
    const patch: { gender?: typeof input.gender; city?: string } = {};
    if (!existing.gender) patch.gender = input.gender;
    if (!existing.city && city) patch.city = city;
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({
        where: { id: existing.id },
        data: patch,
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
      city: input.city.trim(),
      memberships: { create: { clubId, role: "PLAYER" } },
    },
    select: { id: true },
  });
  return { ok: true, id: user.id };
}

export async function registerPublicPair(
  input: unknown,
): Promise<
  | { ok: true; manageToken: string; managePath: string }
  | { ok: false; error: string }
> {
  const parsed = publicInscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const loggedInUserId =
    typeof input === "object" &&
    input &&
    "loggedInUserId" in input &&
    typeof (input as { loggedInUserId?: unknown }).loggedInUserId === "string"
      ? (input as { loggedInUserId: string }).loggedInUserId.trim() || undefined
      : undefined;

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

  const player1 = await ensureClubPlayer(
    tournament.clubId,
    parsed.data.player1,
    loggedInUserId ? { forceUserId: loggedInUserId } : undefined,
  );
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

  let manageToken = result.manageToken ?? null;
  if (!manageToken) {
    manageToken = createManageToken();
    await prisma.tournamentPair.update({
      where: { id: result.id },
      data: { manageToken },
    });
  }

  return {
    ok: true,
    manageToken,
    managePath: pairManagePath(tournament.publicSlug, manageToken),
  };
}

export async function updatePublicPair(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const manageToken =
    typeof input === "object" &&
    input &&
    "manageToken" in input &&
    typeof (input as { manageToken?: unknown }).manageToken === "string"
      ? (input as { manageToken: string }).manageToken.trim()
      : "";
  if (!manageToken) return { ok: false, error: "Link inválido." };

  const parsed = publicInscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const found = await findPublicPairByManageToken(
    parsed.data.publicSlug,
    manageToken,
  );
  if (!found.ok) return found;
  if (found.pair.status === "CANCEL_REQUESTED") {
    return { ok: false, error: "Hay un pedido de baja pendiente." };
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
  const updated = await repo.updatePair(
    tournament.clubId,
    tournament.id,
    found.pair.id,
    {
      categoryId: category.id,
      player1Id: player1.id,
      player2Id: player2.id,
    },
  );
  if (!updated.ok) {
    return { ok: false, error: updated.error ?? "No se pudo actualizar." };
  }

  const prefs = await repo.replacePairSlotPreferences(
    tournament.clubId,
    tournament.id,
    found.pair.id,
    { slots: parsed.data.slots },
  );
  if (!prefs.ok) {
    return { ok: false, error: prefs.error ?? "No se pudieron guardar los horarios." };
  }

  const days = await repo.updatePairZonesDayPreference(
    tournament.clubId,
    tournament.id,
    found.pair.id,
    parsed.data.zonesDayPreference,
  );
  if (!days.ok) {
    return {
      ok: false,
      error: days.error ?? "No se pudo guardar la preferencia de días.",
    };
  }

  revalidatePath(`/${tournament.club.slug}/torneos`);
  revalidatePath(`/${tournament.club.slug}/torneos/${tournament.id}`);
  revalidatePath(`/inscripcion/${tournament.publicSlug}`);
  revalidatePath(
    `/inscripcion/${tournament.publicSlug}/gestionar/${manageToken}`,
  );
  return { ok: true };
}
