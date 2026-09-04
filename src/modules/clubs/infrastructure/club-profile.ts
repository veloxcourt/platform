import { prisma } from "@/lib/prisma";
import type { ClubProfile } from "../domain/club-profile-schema";

let clubProfileColumnsReady = false;

export async function ensureClubProfileColumns() {
  if (clubProfileColumnsReady) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "locality" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "address" TEXT`,
  );
  clubProfileColumnsReady = true;
}

type ClubRow = {
  logoUrl: string | null;
  locality: string | null;
  address: string | null;
};

export async function getClubProfile(clubId: string): Promise<ClubProfile | null> {
  await ensureClubProfileColumns();
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { name: true },
  });
  if (!club) return null;
  const extra = await prisma.$queryRawUnsafe<ClubRow[]>(
    `SELECT "logoUrl", "locality", "address" FROM "clubs" WHERE "id" = $1`,
    clubId,
  );
  return {
    name: club.name,
    logoUrl: extra[0]?.logoUrl ?? null,
    locality: extra[0]?.locality ?? null,
    address: extra[0]?.address ?? null,
  };
}

export async function updateClubProfile(
  clubId: string,
  input: {
    name: string;
    locality: string | null;
    address: string | null;
  },
) {
  await ensureClubProfileColumns();
  await prisma.club.update({
    where: { id: clubId },
    data: { name: input.name },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE "clubs" SET "locality" = $2, "address" = $3 WHERE "id" = $1`,
    clubId,
    input.locality,
    input.address,
  );
}

export async function setClubLogoUrl(clubId: string, logoUrl: string | null) {
  await ensureClubProfileColumns();
  await prisma.$executeRawUnsafe(
    `UPDATE "clubs" SET "logoUrl" = $2 WHERE "id" = $1`,
    clubId,
    logoUrl,
  );
}
