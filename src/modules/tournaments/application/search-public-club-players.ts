import { digitsOnly, formatPhoneDisplay, normalizeToE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import type { Gender } from "@/modules/bookings/domain/new-player-schema";
import { requiredGenderFromCategoryName } from "@/modules/tournaments/domain/category-player-filter";

export type PublicClubPlayerMatch = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: Gender | null;
  phoneHint: string;
};

const MIN_QUERY_CHARS = 2;
const MAX_RESULTS = 8;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function splitStoredName(user: {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
}): { firstName: string; lastName: string } {
  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  if (firstName || lastName) return { firstName, lastName };
  const parts = user.fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function phoneHint(phone: string | null): string {
  const digits = digitsOnly(phone ?? "");
  if (digits.length < 4) return "";
  return `···${digits.slice(-4)}`;
}

/// Busca socios del club del torneo público. No devuelve el padrón completo.
export async function searchPublicClubPlayers(
  publicSlug: string,
  query: string,
  excludeIds: string[] = [],
  categoryName?: string,
): Promise<PublicClubPlayerMatch[]> {
  const trimmed = query.trim();
  const tokens = normalizeText(trimmed)
    .split(/\s+/)
    .filter((token) => token.length >= MIN_QUERY_CHARS);
  const phoneDigits = digitsOnly(trimmed);
  const e164 = phoneDigits.length >= 6
    ? normalizeToE164(trimmed)
    : null;

  if (tokens.length === 0 && phoneDigits.length < 4) return [];

  const tournament = await prisma.tournament.findFirst({
    where: { publicSlug },
    select: { clubId: true, type: true, status: true },
  });
  if (!tournament) return [];
  if (tournament.type !== "ZONAS") return [];
  if (tournament.status === "CLOSED" || tournament.status === "FINISHED") {
    return [];
  }

  const nameToken = trimmed.split(/\s+/).find((part) => part.length >= MIN_QUERY_CHARS);
  const filters = [
    ...(nameToken
      ? [
          { fullName: { contains: nameToken, mode: "insensitive" as const } },
          { firstName: { contains: nameToken, mode: "insensitive" as const } },
          { lastName: { contains: nameToken, mode: "insensitive" as const } },
        ]
      : []),
    ...(e164 ? [{ phone: e164 }] : []),
    ...(phoneDigits.length >= 4 ? [{ phone: { contains: phoneDigits } }] : []),
  ];
  if (filters.length === 0) return [];

  const requiredGender = categoryName
    ? requiredGenderFromCategoryName(categoryName)
    : null;

  const users = await prisma.user.findMany({
    where: {
      memberships: { some: { clubId: tournament.clubId } },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      ...(requiredGender ? { gender: requiredGender } : {}),
      OR: filters,
    },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
      gender: true,
    },
    take: 40,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { fullName: "asc" }],
  });

  return users
    .filter((user) => {
      const names = splitStoredName(user);
      const haystack = normalizeText(
        `${names.firstName} ${names.lastName} ${user.fullName}`,
      );
      const nameOk =
        tokens.length === 0 || tokens.every((token) => haystack.includes(token));
      const storedDigits = digitsOnly(user.phone ?? "");
      const phoneOk =
        phoneDigits.length < 4 ||
        storedDigits.includes(phoneDigits) ||
        (e164 != null && user.phone === e164);
      return nameOk && phoneOk;
    })
    .slice(0, MAX_RESULTS)
    .map((user) => {
      const names = splitStoredName(user);
      return {
        id: user.id,
        firstName: names.firstName,
        lastName: names.lastName,
        phone: formatPhoneDisplay(user.phone) || (user.phone ?? ""),
        gender: user.gender,
        phoneHint: phoneHint(user.phone),
      };
    });
}
