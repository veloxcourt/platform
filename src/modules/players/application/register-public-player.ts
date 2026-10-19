import { revalidatePath } from "next/cache";

import { ensureRuntimeSchema, prisma } from "@/lib/prisma";
import {
  normalizeInstagram,
  normalizeNickname,
  playerPhoneToE164,
} from "@/modules/bookings/domain/new-player-schema";
import type { CourtPosition, Gender } from "@/modules/bookings/domain/new-player-schema";
import { normalizeCategoryLevel } from "@/modules/tournaments/domain/category-level";
import { publicPlayerSignupSchema } from "@/modules/players/domain/public-signup-schema";
import { catalogCityAssignment } from "@/modules/cities/application/city-catalog";

export type RegisterPublicPlayerResult =
  | { ok: true; already: boolean; clubName: string }
  | { ok: false; error: string };

type BlankPatch = {
  email?: string | null;
  gender?: Gender | null;
  city?: string | null;
  catalogCityId?: string | null;
  category?: string | null;
  courtPosition?: CourtPosition | null;
};

/// Da de alta un jugador desde el link público, sin login del club.
/// Si el teléfono ya está en el club, no duplica la ficha.
export async function registerPublicPlayer(
  input: unknown,
): Promise<RegisterPublicPlayerResult> {
  const parsed = publicPlayerSignupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const data = parsed.data;
  const club = await prisma.club.findUnique({
    where: { slug: data.clubSlug },
    select: { id: true, name: true, slug: true, categories: true },
  });
  if (!club) return { ok: false, error: "Club no encontrado" };

  const phone = playerPhoneToE164(data);
  if (!phone) return { ok: false, error: "Teléfono inválido. Ej: 11 2345 6789" };

  const email = data.email?.trim().toLowerCase() || null;
  const nickname = normalizeNickname(data.nickname);
  const instagram = normalizeInstagram(data.instagram);
  const gender = (data.gender || null) as Gender | null;
  const located = await catalogCityAssignment(data.catalogCityId);
  if (!located.ok) return located;
  const city = located.name;
  const catalogCityId = located.catalogCityId;
  const courtPosition = (data.courtPosition || null) as CourtPosition | null;
  const categoryRaw = data.category?.trim() ?? "";
  const category = categoryRaw ? normalizeCategoryLevel(categoryRaw) : null;
  // Si el club todavía no cargó categorías, no podemos exigirla.
  if (club.categories.length > 0 && !category) {
    return { ok: false, error: "Elegí tu categoría" };
  }
  if (category && !club.categories.includes(category)) {
    return { ok: false, error: "Elegí una categoría del club" };
  }

  const existing = await prisma.user.findFirst({
    where: { phone },
    select: {
      id: true,
      email: true,
      gender: true,
      city: true,
      catalogCityId: true,
      category: true,
      courtPosition: true,
      memberships: {
        where: { clubId: club.id, role: "PLAYER" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (existing) {
    const already = existing.memberships.length > 0;
    if (!already) {
      await prisma.membership.create({
        data: { clubId: club.id, userId: existing.id, role: "PLAYER" },
      });
    }
    await fillBlankProfile(existing, {
      email,
      gender,
      city,
      catalogCityId,
      category,
      courtPosition,
    });
    await fillBlankNickname(existing.id, nickname);
    await fillBlankInstagram(existing.id, instagram);
    revalidateClubPlayers(club.slug);
    return { ok: true, already, clubName: club.name };
  }

  if (email) {
    const emailOwner = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (emailOwner) {
      return {
        ok: false,
        error: "Ese email ya está registrado con otro teléfono.",
      };
    }
  }

  try {
    const user = await prisma.user.create({
      data: {
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        phone,
        gender,
        city,
        catalogCityId,
        category,
        courtPosition,
        ranking: null,
        accumulatedPoints: 0,
        memberships: {
          create: { clubId: club.id, role: "PLAYER" },
        },
      },
      select: { id: true },
    });
    if (nickname) await writeNickname(user.id, nickname);
    if (instagram) await writeInstagram(user.id, instagram);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return {
        ok: false,
        error: "Ese email ya está registrado con otro teléfono.",
      };
    }
    throw error;
  }

  revalidateClubPlayers(club.slug);
  return { ok: true, already: false, clubName: club.name };
}

async function fillBlankProfile(
  existing: {
    id: string;
    email: string | null;
    gender: Gender | null;
    city: string | null;
    catalogCityId: string | null;
    category: string | null;
    courtPosition: CourtPosition | null;
  },
  incoming: BlankPatch,
) {
  const patch: BlankPatch = {};
  if (!existing.gender && incoming.gender) patch.gender = incoming.gender;
  if (!existing.catalogCityId && incoming.catalogCityId) {
    patch.catalogCityId = incoming.catalogCityId;
    if (!existing.city && incoming.city) patch.city = incoming.city;
  } else if (!existing.city && incoming.city) {
    patch.city = incoming.city;
  }
  if (!existing.category && incoming.category) patch.category = incoming.category;
  if (!existing.courtPosition && incoming.courtPosition) {
    patch.courtPosition = incoming.courtPosition;
  }
  if (!existing.email && incoming.email) {
    const taken = await prisma.user.findFirst({
      where: { email: incoming.email, NOT: { id: existing.id } },
      select: { id: true },
    });
    if (!taken) patch.email = incoming.email;
  }
  if (Object.keys(patch).length === 0) return;
  await prisma.user.update({ where: { id: existing.id }, data: patch });
}

async function fillBlankNickname(userId: string, nickname: string | null) {
  if (!nickname) return;
  const current = await readNickname(userId);
  if (current) return;
  await writeNickname(userId, nickname);
}

async function readNickname(userId: string): Promise<string | null> {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ nickname: string | null }>>(
    `SELECT "nickname" FROM "users" WHERE "id" = $1`,
    userId,
  );
  const value = rows[0]?.nickname?.trim() ?? "";
  return value || null;
}

async function writeNickname(userId: string, nickname: string) {
  await ensureRuntimeSchema();
  await prisma.$executeRawUnsafe(
    `UPDATE "users" SET "nickname" = $1 WHERE "id" = $2`,
    nickname,
    userId,
  );
}

async function fillBlankInstagram(userId: string, instagram: string | null) {
  if (!instagram) return;
  const current = await readInstagram(userId);
  if (current) return;
  await writeInstagram(userId, instagram);
}

async function readInstagram(userId: string): Promise<string | null> {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ instagram: string | null }>>(
    `SELECT "instagram" FROM "users" WHERE "id" = $1`,
    userId,
  );
  const value = rows[0]?.instagram?.trim() ?? "";
  return value || null;
}

async function writeInstagram(userId: string, instagram: string) {
  await ensureRuntimeSchema();
  await prisma.$executeRawUnsafe(
    `UPDATE "users" SET "instagram" = $1 WHERE "id" = $2`,
    instagram,
    userId,
  );
}

function revalidateClubPlayers(clubSlug: string) {
  revalidatePath(`/${clubSlug}/jugadores`);
  revalidatePath(`/${clubSlug}/turnos`);
}
