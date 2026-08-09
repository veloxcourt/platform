import { prisma } from "@/lib/prisma";
import { ensureClubUserTypes } from "@/lib/auth/user-types";
import { toDatabaseModules } from "@/lib/auth/permissions";
import { ALL_PRIVILEGES } from "@/config/modules";

import type { CreateClubValues } from "../domain/create-club-schema";

export type CreateClubResult =
  | { ok: true; clubId: string; slug: string }
  | { ok: false; error: string };

export async function createClub(
  values: CreateClubValues,
): Promise<CreateClubResult> {
  const existingSlug = await prisma.club.findUnique({
    where: { slug: values.slug },
    select: { id: true },
  });
  if (existingSlug) {
    return { ok: false, error: "Ese slug ya está en uso." };
  }

  const club = await prisma.$transaction(async (tx) => {
    const created = await tx.club.create({
      data: {
        name: values.name,
        slug: values.slug,
        enabledModules: ["turnos", "torneos", "herramientas"],
        bookingSettings: {
          create: {
            openTime: "08:00",
            closeTime: "23:00",
            slotDurationMin: 90,
            intervalMin: 0,
            preReservationMin: 15,
            requirePrePayment: false,
          },
        },
      },
    });

    let owner = await tx.user.findFirst({
      where: { email: { equals: values.ownerEmail, mode: "insensitive" } },
    });

    if (owner) {
      owner = await tx.user.update({
        where: { id: owner.id },
        data: { fullName: values.ownerName, email: values.ownerEmail },
      });
    } else {
      owner = await tx.user.create({
        data: {
          fullName: values.ownerName,
          email: values.ownerEmail,
        },
      });
    }

    // Tipos base se crean fuera de la transacción vía ensureClubUserTypes.
    return { club: created, owner };
  });

  const { ownerType } = await ensureClubUserTypes(club.club.id);

  await prisma.membership.upsert({
    where: {
      clubId_userId_role: {
        clubId: club.club.id,
        userId: club.owner.id,
        role: "OWNER",
      },
    },
    update: {
      userTypeId: ownerType.id,
      staffStatus: "ACTIVE",
      allowedModules: toDatabaseModules(ALL_PRIVILEGES),
      disabledAt: null,
    },
    create: {
      clubId: club.club.id,
      userId: club.owner.id,
      role: "OWNER",
      userTypeId: ownerType.id,
      staffStatus: "ACTIVE",
      allowedModules: toDatabaseModules(ALL_PRIVILEGES),
      acceptedAt: new Date(),
    },
  });

  if (values.requestId) {
    await prisma.clubRequest.updateMany({
      where: { id: values.requestId, status: "PENDING" },
      data: {
        status: "APPROVED",
        createdClubId: club.club.id,
        reviewedAt: new Date(),
      },
    });
  }

  return { ok: true, clubId: club.club.id, slug: club.club.slug };
}
