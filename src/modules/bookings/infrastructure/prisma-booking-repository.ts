import { Prisma } from "@prisma/client";
import { ensureRuntimeSchema, prisma } from "@/lib/prisma";
import { normalizeCategoryLevel } from "@/modules/tournaments/domain/category-level";
import type {
  BookingRepository,
  MutationResult,
} from "../application/booking-repository";
import type {
  ProductListItem,
  ProductType,
  SellableProduct,
} from "@/modules/catalog/domain/types";
import type { ProductValues } from "@/modules/catalog/domain/product-schema";
import { totalRecipeCostCents } from "@/modules/catalog/domain/recipe-cost";
import type {
  Booking,
  BookingSettings,
  BookingType,
  FixedBookingType,
  WritableBookingSettings,
  ClubInfo,
  Court,
  CreateBookingData,
  CreateFixedBookingInput,
  FixedBookingTemplate,
  PaymentStatus,
  ReleasedFixedSlot,
  PlayerListItem,
  PlayerRef,
  UpdateBookingData,
  UpdateFixedBookingData,
} from "../domain/types";
import type { CourtInput } from "../domain/settings-schema";
import type { NewPlayerValues } from "../domain/new-player-schema";
import {
  normalizeInstagram,
  playerPhoneToE164,
} from "../domain/new-player-schema";
import {
  latestClubTournamentId,
  visiblePlayerObservation,
  writePlayerObservation,
} from "@/modules/players/application/save-player-invite-note";
import { splitPhoneForForm } from "@/lib/phone";
import type {
  AddMovementData,
  PlayerAccount,
} from "@/modules/accounts/domain/types";
import {
  dayOfWeekISO,
  expandFixedBookings,
  timeRangesOverlap,
} from "../domain/rules";
import { addDaysISO } from "@/lib/date";
import { formatQuantity } from "@/lib/quantity";

function prismaUserHasInstagram(): boolean {
  return "instagram" in Prisma.UserScalarFieldEnum;
}

async function persistUserInstagram(userId: string, instagram: string | null) {
  await ensureRuntimeSchema();
  await prisma.$executeRawUnsafe(
    `UPDATE "users" SET "instagram" = $1 WHERE "id" = $2`,
    instagram,
    userId,
  );
}

async function readUserInstagram(
  userId: string,
  fromClient?: string | null,
): Promise<string> {
  if (prismaUserHasInstagram()) return fromClient ?? "";
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ instagram: string | null }>>(
    `SELECT "instagram" FROM "users" WHERE "id" = $1`,
    userId,
  );
  return rows[0]?.instagram ?? "";
}

/// Instagram de varios usuarios de una, para no pegarle a la base por fila.
async function readManyUsersInstagram(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; instagram: string | null }>
  >`SELECT "id", "instagram" FROM "users" WHERE "id" IN (${Prisma.join(userIds)})`;
  for (const row of rows) {
    const value = row.instagram?.trim();
    if (value) map.set(row.id, value);
  }
  return map;
}

/// El proceso de Next puede seguir con un cliente Prisma anterior a esta columna.
/// Leer y escribir por SQL evita el error "Unknown argument availabilityIntro".
async function readAvailabilityIntro(clubId: string): Promise<string> {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ availabilityIntro: string | null }>
  >(
    `SELECT "availabilityIntro" FROM "booking_settings" WHERE "clubId" = $1`,
    clubId,
  );
  return rows[0]?.availabilityIntro ?? "";
}

async function writeAvailabilityIntro(clubId: string, intro: string) {
  await ensureRuntimeSchema();
  await prisma.$executeRawUnsafe(
    `UPDATE "booking_settings" SET "availabilityIntro" = $1 WHERE "clubId" = $2`,
    intro,
    clubId,
  );
}

const DEFAULT_SETTINGS: BookingSettings = {
  openTime: "08:00",
  closeTime: "23:00",
  slotDurationMin: 90,
  intervalMin: 0,
  preReservationMin: 15,
  requirePrePayment: false,
  turnoProductId: null,
  availabilityIntro: "",
  bookingPrice: 0,
};

/// Resuelve el precio (centavos) del producto que define el turno.
async function resolveTurnoPrice(
  clubId: string,
  turnoProductId: string | null,
): Promise<number> {
  if (!turnoProductId) return 0;
  const product = await prisma.product.findFirst({
    where: { id: turnoProductId, clubId },
    select: { price: true },
  });
  return product?.price ?? 0;
}

type ResolveRecipeResult =
  | {
      ok: true;
      cost: number;
      components: { componentId: string; quantity: number }[];
    }
  | { ok: false; error: string };

/// Valida componentes (solo simples del club) y calcula el costo del conjunto.
async function resolveProductCostAndComponents(
  clubId: string,
  input: ProductValues,
  parentId?: string,
): Promise<ResolveRecipeResult> {
  if (!input.isComposite) {
    return { ok: true, cost: input.cost, components: [] };
  }

  const components = input.components ?? [];
  if (components.length === 0) {
    return { ok: true, cost: 0, components: [] };
  }

  const ids = [...new Set(components.map((c) => c.componentId))];
  if (parentId && ids.includes(parentId)) {
    return { ok: false, error: "Un conjunto no puede incluirse a sí mismo" };
  }

  const rows = await prisma.product.findMany({
    where: { clubId, id: { in: ids } },
    select: {
      id: true,
      cost: true,
      baseQuantity: true,
      isComposite: true,
    },
  });
  if (rows.length !== ids.length) {
    return { ok: false, error: "Hay componentes inválidos o de otro club" };
  }
  if (rows.some((r) => r.isComposite)) {
    return {
      ok: false,
      error: "La receta solo admite productos simples (sin combos)",
    };
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const cost = totalRecipeCostCents(
    components.map((c) => {
      const row = byId.get(c.componentId)!;
      return {
        componentCostCents: row.cost,
        componentBaseQty: row.baseQuantity,
        recipeQty: c.quantity,
      };
    }),
  );

  return {
    ok: true,
    cost,
    components: components.map((c) => ({
      componentId: c.componentId,
      quantity: c.quantity,
    })),
  };
}

/// Convierte "YYYY-MM-DD" a un Date UTC a medianoche (para columnas `@db.Date`).
function toDbDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

function rawDateToISO(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/// Día calendario en la zona del club. createdAt en UTC no sirve: después de
/// las 21 en Argentina, toISOString() ya es el día siguiente y el turno fijo
/// desaparece de la celda en la que se acaba de crear.
function isoDateInTimeZone(value: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Zona inválida: se usa el día UTC.
  }
  return rawDateToISO(value);
}

type FixedReleaseRow = {
  fixedBookingId: string;
  date: Date | string;
  courtId: string;
  startTime: string;
  durationMin: number;
  type: FixedBookingType;
  userId: string;
  fullName: string;
};

/// La tabla se crea en caliente. El proceso de Next puede seguir con un cliente
/// de Prisma generado antes del modelo, así que no usamos ese delegate.
async function queryFixedReleases(
  clubId: string,
  range?: { start: string; end: string },
): Promise<FixedReleaseRow[]> {
  await ensureRuntimeSchema();
  const rows = range
    ? await prisma.$queryRawUnsafe<FixedReleaseRow[]>(
      `SELECT r."fixedBookingId", r."date", f."courtId", f."startTime", f."durationMin",
              f."type"::text AS "type", u."id" AS "userId", u."fullName"
       FROM "fixed_booking_releases" r
       INNER JOIN "fixed_bookings" f ON f."id" = r."fixedBookingId"
       INNER JOIN "users" u ON u."id" = f."responsibleId"
       WHERE f."clubId" = $1
         AND f."active" = true
         AND r."date" >= $2::date
         AND r."date" <= $3::date`,
      clubId,
      range.start,
      range.end,
    )
    : await prisma.$queryRawUnsafe<FixedReleaseRow[]>(
        `SELECT r."fixedBookingId", r."date", f."courtId", f."startTime", f."durationMin",
                f."type"::text AS "type", u."id" AS "userId", u."fullName"
         FROM "fixed_booking_releases" r
         INNER JOIN "fixed_bookings" f ON f."id" = r."fixedBookingId"
         INNER JOIN "users" u ON u."id" = f."responsibleId"
         WHERE f."clubId" = $1 AND f."active" = true`,
        clubId,
      );
  return rows.map((row) => ({
    ...row,
    durationMin: Number(row.durationMin),
    type: row.type === "CLASE_FIJO" ? "CLASE_FIJO" : "FIJO",
  }));
}

type FixedPlayerRow = {
  fixedBookingId: string;
  playersSet: boolean;
  userId: string | null;
  fullName: string | null;
  position: number | null;
};

async function queryFixedPlayers(clubId: string): Promise<FixedPlayerRow[]> {
  await ensureRuntimeSchema();
  return prisma.$queryRawUnsafe<FixedPlayerRow[]>(
    `SELECT f."id" AS "fixedBookingId",
            f."playersSet",
            p."userId",
            u."fullName",
            p."position"
     FROM "fixed_bookings" f
     LEFT JOIN "fixed_booking_players" p ON p."fixedBookingId" = f."id"
     LEFT JOIN "users" u ON u."id" = p."userId"
     WHERE f."clubId" = $1 AND f."active" = true
     ORDER BY p."position"`,
    clubId,
  );
}

async function writeFixedPlayers(
  fixedBookingId: string,
  clubId: string,
  playerIds: string[],
): Promise<void> {
  await ensureRuntimeSchema();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRawUnsafe(
      `UPDATE "fixed_bookings"
       SET "playersSet" = true
       WHERE "id" = $1 AND "clubId" = $2`,
      fixedBookingId,
      clubId,
    );
    if (Number(updated) === 0) {
      throw new Error("No se encontró el turno fijo");
    }
    await tx.$executeRawUnsafe(
      `DELETE FROM "fixed_booking_players" WHERE "fixedBookingId" = $1`,
      fixedBookingId,
    );
    for (let position = 0; position < playerIds.length; position++) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "fixed_booking_players" ("id", "fixedBookingId", "userId", "position")
         VALUES ($1, $2, $3, $4)`,
        crypto.randomUUID(),
        fixedBookingId,
        playerIds[position],
        position,
      );
    }
  });
}

/// Forma del booking con relaciones incluidas (para el mapeo a dominio).
type BookingRow = {
  id: string;
  courtId: string;
  date: Date;
  startTime: string;
  durationMin: number;
  type: BookingType;
  status: "PRE_RESERVA" | "RESERVADO" | "CANCELLED";
  paymentStatus: string;
  price: number;
  chargeMovementId: string | null;
  responsible: { id: string; fullName: string };
  players: { user: { id: string; fullName: string } }[];
};

function toBookingPaymentStatus(value: string): PaymentStatus {
  if (value === "PAID" || value === "PARTIAL" || value === "UNPAID") {
    return value;
  }
  return "UNPAID";
}

function mapBooking(b: BookingRow): Booking {
  return {
    id: b.id,
    courtId: b.courtId,
    date: b.date.toISOString().slice(0, 10),
    startTime: b.startTime,
    durationMin: b.durationMin,
    type: b.type,
    status: b.status as "PRE_RESERVA" | "RESERVADO",
    paymentStatus: toBookingPaymentStatus(b.paymentStatus),
    price: b.price,
    impacted: b.chargeMovementId != null,
    responsible: { id: b.responsible.id, name: b.responsible.fullName },
    players: b.players.map((p) => ({ id: p.user.id, name: p.user.fullName })),
  };
}

const BOOKING_INCLUDE = {
  responsible: { select: { id: true, fullName: true } },
  players: { select: { user: { select: { id: true, fullName: true } } } },
} as const;

// -----------------------------------------------------------------------------
// Implementación del repositorio de Turnos con Prisma (PostgreSQL / Supabase).
// Todas las operaciones están acotadas por club (multi-tenant).
// -----------------------------------------------------------------------------
export class PrismaBookingRepository implements BookingRepository {
  async getClubBySlug(slug: string): Promise<ClubInfo | null> {
    const club = await prisma.club.findUnique({ where: { slug } });
    if (!club) return null;
    return {
      id: club.id,
      name: club.name,
      slug: club.slug,
      timezone: club.timezone,
      currency: club.currency,
    };
  }

  async getCourts(clubId: string): Promise<Court[]> {
    const courts = await prisma.court.findMany({
      where: { clubId },
      orderBy: { order: "asc" },
    });
    return courts.map((c) => ({
      id: c.id,
      name: c.name,
      active: c.active,
      order: c.order,
    }));
  }

  async getSettings(clubId: string): Promise<BookingSettings> {
    await ensureRuntimeSchema();
    const [s, availabilityIntro] = await Promise.all([
      prisma.bookingSettings.findUnique({ where: { clubId } }),
      readAvailabilityIntro(clubId),
    ]);
    if (!s) return { ...DEFAULT_SETTINGS, availabilityIntro };
    return {
      openTime: s.openTime,
      closeTime: s.closeTime,
      slotDurationMin: s.slotDurationMin,
      intervalMin: s.intervalMin,
      preReservationMin: s.preReservationMin,
      requirePrePayment: s.requirePrePayment,
      turnoProductId: s.turnoProductId,
      availabilityIntro,
      bookingPrice: await resolveTurnoPrice(clubId, s.turnoProductId),
    };
  }

  async getPlayers(clubId: string): Promise<PlayerRef[]> {
    const users = await prisma.user.findMany({
      where: { memberships: { some: { clubId, role: "PLAYER" } } },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        gender: true,
        city: true,
        catalogCity: { select: { name: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.fullName,
      gender: u.gender,
      city: u.catalogCity?.name ?? u.city,
    }));
  }

  async listPlayers(clubId: string): Promise<PlayerListItem[]> {
    const [users, grouped] = await Promise.all([
      prisma.user.findMany({
        where: { memberships: { some: { clubId, role: "PLAYER" } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { fullName: "asc" }],
        include: {
          catalogCity: { select: { name: true } },
          memberships: {
            where: { clubId, role: "PLAYER" },
            select: {
              inviteSentAt: true,
              inviteForTournamentId: true,
              inviteNote: true,
            },
            take: 1,
          },
        },
      }),
      prisma.accountMovement.groupBy({
        by: ["userId", "type"],
        where: { clubId },
        _sum: { amount: true },
      }),
    ]);

    const balanceMap = new Map<string, number>();
    for (const g of grouped) {
      const prev = balanceMap.get(g.userId) ?? 0;
      const amt = g._sum.amount ?? 0;
      balanceMap.set(g.userId, prev + (g.type === "CHARGE" ? amt : -amt));
    }

    const instagramMap = prismaUserHasInstagram()
      ? null
      : await readManyUsersInstagram(users.map((u) => u.id));

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      instagram:
        (instagramMap ? instagramMap.get(u.id) : u.instagram?.trim()) || null,
      gender: u.gender,
      city: u.catalogCity?.name ?? u.city,
      category: u.category ? normalizeCategoryLevel(u.category) : null,
      courtPosition: u.courtPosition,
      ranking: u.ranking,
      accumulatedPoints: u.accumulatedPoints,
      photoUrl: u.photoUrl,
      balance: balanceMap.get(u.id) ?? 0,
      inviteSentAt: u.memberships[0]?.inviteSentAt?.toISOString() ?? null,
      inviteForTournamentId: u.memberships[0]?.inviteForTournamentId ?? null,
      inviteNote: u.memberships[0]?.inviteNote ?? null,
    }));
  }

  async getClubCategories(clubId: string): Promise<string[]> {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { categories: true },
    });
    return club?.categories ?? [];
  }

  async saveCategories(
    clubId: string,
    categories: string[],
  ): Promise<string[]> {
    const club = await prisma.club.update({
      where: { id: clubId },
      data: { categories },
      select: { categories: true },
    });
    return club.categories;
  }

  async getPlayerProfile(
    clubId: string,
    userId: string,
  ): Promise<NewPlayerValues | null> {
    const u = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { clubId, role: "PLAYER" } },
      },
      include: {
        catalogCity: { select: { name: true } },
        memberships: {
          where: { clubId, role: "PLAYER" },
          select: { inviteNote: true, inviteForTournamentId: true },
          take: 1,
        },
      },
    });
    if (!u) return null;
    const phone = splitPhoneForForm(u.phone);
    const membership = u.memberships[0];
    const tournamentId = await latestClubTournamentId(clubId);
    return {
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      phoneCountryDial: phone.dial,
      phoneLocal: phone.local,
      email: u.email ?? "",
      instagram: await readUserInstagram(u.id, u.instagram),
      observation: visiblePlayerObservation(
        membership?.inviteNote,
        membership?.inviteForTournamentId,
        tournamentId,
      ),
      gender: u.gender ?? "",
      birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : "",
      city: u.catalogCity?.name ?? u.city ?? "",
      catalogCityId: u.catalogCityId ?? "",
      address: u.address ?? "",
      country: u.country ?? "",
      category: u.category ? normalizeCategoryLevel(u.category) : "",
      courtPosition: u.courtPosition ?? "",
      ranking: u.ranking,
      accumulatedPoints: u.accumulatedPoints,
    };
  }

  async createPlayer(
    clubId: string,
    input: NewPlayerValues,
  ): Promise<PlayerRef> {
    const observation = (input.observation ?? "").trim().slice(0, 500);
    const tournamentId = observation
      ? await latestClubTournamentId(clubId)
      : null;
    const user = await prisma.user.create({
      data: {
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ? input.email : null,
        phone: (() => {
          const e164 = playerPhoneToE164(input);
          return e164 || null;
        })(),
        gender: input.gender ? input.gender : null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        city: input.city ? input.city : null,
        catalogCityId: input.catalogCityId ? input.catalogCityId : null,
        address: input.address ? input.address : null,
        country: input.country ? input.country : null,
        category: input.category
          ? normalizeCategoryLevel(input.category)
          : null,
        courtPosition: input.courtPosition ? input.courtPosition : null,
        ranking: input.ranking ?? null,
        accumulatedPoints: input.accumulatedPoints ?? 0,
        memberships: {
          create: {
            clubId,
            role: "PLAYER",
            ...(observation
              ? {
                  inviteNote: observation,
                  inviteForTournamentId: tournamentId,
                }
              : {}),
          },
        },
      },
    });
    await persistUserInstagram(user.id, normalizeInstagram(input.instagram));
    return { id: user.id, name: user.fullName, gender: user.gender, city: user.city };
  }

  async updatePlayer(
    clubId: string,
    userId: string,
    input: NewPlayerValues,
  ): Promise<void> {
    const belongs = await prisma.membership.findFirst({
      where: { clubId, userId, role: "PLAYER" },
      select: {
        id: true,
        inviteSentAt: true,
        inviteForTournamentId: true,
        inviteNote: true,
      },
    });
    if (!belongs) return;

    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ? input.email : null,
        phone: (() => {
          const e164 = playerPhoneToE164(input);
          return e164 || null;
        })(),
        gender: input.gender ? input.gender : null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        city: input.city ? input.city : null,
        catalogCityId: input.catalogCityId ? input.catalogCityId : null,
        address: input.address ? input.address : null,
        country: input.country ? input.country : null,
        category: input.category
          ? normalizeCategoryLevel(input.category)
          : null,
        courtPosition: input.courtPosition ? input.courtPosition : null,
        ranking: input.ranking ?? null,
        accumulatedPoints: input.accumulatedPoints ?? 0,
      },
    });
    await persistUserInstagram(userId, normalizeInstagram(input.instagram));

    const tournamentId = await latestClubTournamentId(clubId);
    const current = visiblePlayerObservation(
      belongs.inviteNote,
      belongs.inviteForTournamentId,
      tournamentId,
    );
    const next = (input.observation ?? "").trim();
    if (next !== current) {
      await writePlayerObservation(belongs, tournamentId, next);
    }
  }

  async deletePlayer(
    clubId: string,
    userId: string,
  ): Promise<MutationResult> {
    const membership = await prisma.membership.findFirst({
      where: { clubId, userId, role: "PLAYER" },
      select: { id: true },
    });
    if (!membership) {
      return { ok: false, error: "Jugador no encontrado en este club" };
    }

    const activePair = await prisma.tournamentPair.findFirst({
      where: {
        status: { not: "CANCELLED" },
        tournament: { clubId },
        OR: [{ player1Id: userId }, { player2Id: userId }],
      },
      select: { id: true },
    });
    if (activePair) {
      return {
        ok: false,
        error:
          "Está inscripto en un torneo. Sacalo de las parejas antes de eliminar.",
      };
    }

    const bookingAsResponsible = await prisma.booking.findFirst({
      where: { clubId, responsibleId: userId },
      select: { id: true },
    });
    if (bookingAsResponsible) {
      return {
        ok: false,
        error:
          "Tiene turnos a su nombre. Cancelalos o reasignalos antes de eliminar.",
      };
    }

    const fixedAsResponsible = await prisma.fixedBooking.findFirst({
      where: { clubId, responsibleId: userId, active: true },
      select: { id: true },
    });
    if (fixedAsResponsible) {
      return {
        ok: false,
        error:
          "Tiene un turno fijo activo. Cancelalo antes de eliminar al jugador.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.bookingPlayer.deleteMany({
        where: { userId, booking: { clubId } },
      });
      await tx.accountMovement.deleteMany({
        where: { clubId, userId },
      });
      await tx.playerEvent.deleteMany({
        where: { clubId, playerId: userId },
      });
      await tx.tournamentRegistration.deleteMany({
        where: { userId, tournament: { clubId } },
      });
      await tx.tournamentPair.updateMany({
        where: { player2Id: userId, tournament: { clubId } },
        data: { player2Id: null },
      });
      await tx.tournamentPair.deleteMany({
        where: { player1Id: userId, tournament: { clubId } },
      });
      await tx.membership.delete({ where: { id: membership.id } });

      const remaining = await tx.membership.count({ where: { userId } });
      if (remaining === 0) {
        const stillReferenced =
          (await tx.booking.count({ where: { responsibleId: userId } })) > 0 ||
          (await tx.fixedBooking.count({
            where: { responsibleId: userId },
          })) > 0;
        if (!stillReferenced) {
          await tx.user.delete({ where: { id: userId } });
        }
      }
    });

    return { ok: true };
  }

  async setPlayerPhoto(
    clubId: string,
    userId: string,
    url: string | null,
  ): Promise<void> {
    await prisma.user.updateMany({
      where: {
        id: userId,
        memberships: { some: { clubId, role: "PLAYER" } },
      },
      data: { photoUrl: url },
    });
  }

  async getBookingsForDate(clubId: string, date: string): Promise<Booking[]> {
    await ensureRuntimeSchema();
    const [rows, templates] = await Promise.all([
      prisma.booking.findMany({
        where: { clubId, date: toDbDate(date), status: { not: "CANCELLED" } },
        include: BOOKING_INCLUDE,
      }),
      this.getActiveFixedBookings(clubId, { start: date, end: date }),
    ]);
    return [...rows.map(mapBooking), ...expandFixedBookings(templates, [date])];
  }

  async getBookingsForRange(
    clubId: string,
    startDate: string,
    endDate: string,
  ): Promise<Booking[]> {
    await ensureRuntimeSchema();
    const [rows, templates] = await Promise.all([
      prisma.booking.findMany({
        where: {
          clubId,
          date: { gte: toDbDate(startDate), lte: toDbDate(endDate) },
          status: { not: "CANCELLED" },
        },
        include: BOOKING_INCLUDE,
      }),
      this.getActiveFixedBookings(clubId, { start: startDate, end: endDate }),
    ]);

    const dates: string[] = [];
    for (let d = startDate; d <= endDate; d = addDaysISO(d, 1)) {
      dates.push(d);
    }

    return [
      ...rows.map(mapBooking),
      ...expandFixedBookings(templates, dates),
    ];
  }

  async updateSettings(
    clubId: string,
    settings: WritableBookingSettings,
  ): Promise<BookingSettings> {
    await ensureRuntimeSchema();
    const { availabilityIntro, ...rest } = settings;
    const s = await prisma.bookingSettings.upsert({
      where: { clubId },
      update: rest,
      create: { clubId, ...rest },
    });
    await writeAvailabilityIntro(clubId, availabilityIntro);
    return {
      openTime: s.openTime,
      closeTime: s.closeTime,
      slotDurationMin: s.slotDurationMin,
      intervalMin: s.intervalMin,
      preReservationMin: s.preReservationMin,
      requirePrePayment: s.requirePrePayment,
      turnoProductId: s.turnoProductId,
      availabilityIntro,
      bookingPrice: await resolveTurnoPrice(clubId, s.turnoProductId),
    };
  }

  async saveCourts(clubId: string, courts: CourtInput[]): Promise<Court[]> {
    const existing = await prisma.court.findMany({
      where: { clubId },
      select: { id: true },
    });
    const keepIds = courts
      .map((c) => c.id)
      .filter((id): id is string => Boolean(id));
    const toDelete = existing
      .filter((c) => !keepIds.includes(c.id))
      .map((c) => c.id);

    const ops = [
      ...courts.map((c, index) =>
        c.id
          ? prisma.court.updateMany({
              where: { id: c.id, clubId },
              data: { name: c.name, active: c.active, order: index + 1 },
            })
          : prisma.court.create({
              data: {
                clubId,
                name: c.name,
                active: c.active,
                order: index + 1,
              },
            }),
      ),
      ...(toDelete.length
        ? [prisma.court.deleteMany({ where: { id: { in: toDelete }, clubId } })]
        : []),
    ];

    await prisma.$transaction(ops);
    return this.getCourts(clubId);
  }

  async createBooking(
    clubId: string,
    data: CreateBookingData,
  ): Promise<Booking> {
    await ensureRuntimeSchema();
    const created = await prisma.booking.create({
      data: {
        clubId,
        courtId: data.courtId,
        date: toDbDate(data.date),
        startTime: data.startTime,
        durationMin: data.durationMin,
        type: data.type,
        status: data.status,
        paymentStatus: data.paymentStatus,
        price: data.price,
        responsibleId: data.responsibleId,
        createdById: data.createdById,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        players: {
          create: data.playerIds.map((userId) => ({ userId })),
        },
      },
      include: BOOKING_INCLUDE,
    });
    return mapBooking(created);
  }

  async updateBooking(
    clubId: string,
    bookingId: string,
    data: UpdateBookingData,
  ): Promise<void> {
    // Acotado por club: sólo actualiza si el booking pertenece al club.
    const existing = await prisma.booking.findFirst({
      where: { id: bookingId, clubId },
      select: { id: true },
    });
    if (!existing) return;

    await ensureRuntimeSchema();
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        type: data.type,
        responsibleId: data.responsibleId,
        status: data.status,
        paymentStatus: data.paymentStatus,
        price: data.price,
        expiresAt: data.status === "RESERVADO" ? null : undefined,
        players: {
          deleteMany: {},
          create: data.playerIds.map((userId) => ({ userId })),
        },
      },
    });
  }

  async confirmBooking(clubId: string, bookingId: string): Promise<void> {
    await prisma.booking.updateMany({
      where: { id: bookingId, clubId },
      data: { status: "RESERVADO", expiresAt: null },
    });
  }

  async cancelBooking(clubId: string, bookingId: string): Promise<void> {
    await prisma.booking.updateMany({
      where: { id: bookingId, clubId },
      data: { status: "CANCELLED" },
    });
  }

  async setBookingStatus(
    clubId: string,
    bookingId: string,
    status: "PRE_RESERVA" | "RESERVADO",
  ): Promise<void> {
    await prisma.booking.updateMany({
      where: { id: bookingId, clubId },
      data: {
        status,
        // Al volver a RESERVADO se limpia el vencimiento de la pre-reserva.
        expiresAt: status === "RESERVADO" ? null : undefined,
      },
    });
  }

  async setBookingPayment(
    clubId: string,
    bookingId: string,
    status: PaymentStatus,
  ): Promise<void> {
    await prisma.booking.updateMany({
      where: { id: bookingId, clubId },
      data: { paymentStatus: status },
    });
  }

  async getActiveFixedBookings(
    clubId: string,
    range?: { start: string; end: string },
  ): Promise<FixedBookingTemplate[]> {
    await ensureRuntimeSchema();
    const [rows, releases, playerRows] = await Promise.all([
      prisma.fixedBooking.findMany({
        where: { clubId, active: true },
        include: {
          responsible: { select: { id: true, fullName: true } },
          club: { select: { timezone: true } },
        },
      }),
      queryFixedReleases(clubId, range),
      queryFixedPlayers(clubId),
    ]);
    const releasedDates = new Map<string, string[]>();
    for (const release of releases) {
      const date = rawDateToISO(release.date);
      const dates = releasedDates.get(release.fixedBookingId);
      if (dates) dates.push(date);
      else releasedDates.set(release.fixedBookingId, [date]);
    }
    const playersByFixed = new Map<
      string,
      { playersSet: boolean; players: PlayerRef[] }
    >();
    for (const row of playerRows) {
      let entry = playersByFixed.get(row.fixedBookingId);
      if (!entry) {
        entry = { playersSet: Boolean(row.playersSet), players: [] };
        playersByFixed.set(row.fixedBookingId, entry);
      }
      if (row.userId && row.fullName) {
        entry.players.push({ id: row.userId, name: row.fullName });
      }
    }
    return rows.map((f) => {
      const stored = playersByFixed.get(f.id);
      return {
        id: f.id,
        courtId: f.courtId,
        dayOfWeek: f.dayOfWeek,
        startTime: f.startTime,
        durationMin: f.durationMin,
        type: f.type === "CLASE_FIJO" ? "CLASE_FIJO" : "FIJO",
        responsible: { id: f.responsible.id, name: f.responsible.fullName },
        players: stored?.players ?? [],
        playersSet: stored?.playersSet ?? false,
        startDate: isoDateInTimeZone(
          f.createdAt,
          f.club.timezone || "America/Argentina/Buenos_Aires",
        ),
        releasedDates: releasedDates.get(f.id) ?? [],
      };
    });
  }

  async createFixedBooking(
    clubId: string,
    input: CreateFixedBookingInput,
  ): Promise<string> {
    await ensureRuntimeSchema();
    const created = await prisma.fixedBooking.create({
      data: {
        clubId,
        courtId: input.courtId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        durationMin: input.durationMin,
        type: input.type,
        responsibleId: input.responsibleId,
        // Mediodía UTC del día elegido: la serie empieza en esa celda, no al
        // día siguiente por el desfase con UTC.
        createdAt: new Date(`${input.startDate}T12:00:00.000Z`),
      },
      select: { id: true },
    });
    if (input.playerIds.length > 0) {
      await writeFixedPlayers(created.id, clubId, input.playerIds);
    }
    return created.id;
  }

  async updateFixedBooking(
    clubId: string,
    fixedBookingId: string,
    data: UpdateFixedBookingData,
  ): Promise<MutationResult> {
    const fixed = await prisma.fixedBooking.findFirst({
      where: { id: fixedBookingId, clubId, active: true },
      select: { id: true },
    });
    if (!fixed) return { ok: false, error: "No se encontró el turno fijo" };

    try {
      await ensureRuntimeSchema();
      await prisma.fixedBooking.updateMany({
        where: { id: fixedBookingId, clubId },
        data: { responsibleId: data.responsibleId, type: data.type },
      });
      await writeFixedPlayers(fixedBookingId, clubId, data.playerIds);
    } catch (error) {
      console.error("[turnos] updateFixedBooking", error);
      return { ok: false, error: "No se pudo guardar el turno fijo" };
    }
    return { ok: true };
  }

  async cancelFixedBooking(
    clubId: string,
    fixedBookingId: string,
  ): Promise<void> {
    await prisma.fixedBooking.updateMany({
      where: { id: fixedBookingId, clubId },
      data: { active: false },
    });
  }

  async getReleasedFixedSlots(
    clubId: string,
    startDate: string,
    endDate: string,
  ): Promise<ReleasedFixedSlot[]> {
    const rows = await queryFixedReleases(clubId, {
      start: startDate,
      end: endDate,
    });
    return rows.map((row) => ({
      fixedBookingId: row.fixedBookingId,
      courtId: row.courtId,
      date: rawDateToISO(row.date),
      startTime: row.startTime,
      durationMin: row.durationMin,
      type: row.type,
      responsible: { id: row.userId, name: row.fullName },
    }));
  }

  async releaseFixedOccurrence(
    clubId: string,
    fixedBookingId: string,
    date: string,
  ): Promise<MutationResult> {
    await ensureRuntimeSchema();
    const fixed = await prisma.fixedBooking.findFirst({
      where: { id: fixedBookingId, clubId, active: true },
      select: { id: true, dayOfWeek: true },
    });
    if (!fixed) return { ok: false, error: "No se encontró el turno fijo" };
    if (dayOfWeekISO(date) !== fixed.dayOfWeek) {
      return { ok: false, error: "Ese día no corresponde al turno fijo" };
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "fixed_booking_releases" ("id", "fixedBookingId", "date")
       VALUES ($1, $2, $3::date)
       ON CONFLICT ("fixedBookingId", "date") DO NOTHING`,
      crypto.randomUUID(),
      fixedBookingId,
      date,
    );
    return { ok: true };
  }

  async restoreFixedOccurrence(
    clubId: string,
    fixedBookingId: string,
    date: string,
  ): Promise<MutationResult> {
    await ensureRuntimeSchema();
    const fixed = await prisma.fixedBooking.findFirst({
      where: { id: fixedBookingId, clubId, active: true },
      select: {
        id: true,
        courtId: true,
        startTime: true,
        durationMin: true,
      },
    });
    if (!fixed) return { ok: false, error: "No se encontró el turno fijo" };

    const rows = await prisma.booking.findMany({
      where: {
        clubId,
        courtId: fixed.courtId,
        date: toDbDate(date),
        status: { not: "CANCELLED" },
      },
      select: { startTime: true, durationMin: true },
    });
    const taken = rows.some((row) =>
      timeRangesOverlap(
        row.startTime,
        row.durationMin,
        fixed.startTime,
        fixed.durationMin,
      ),
    );
    if (taken) return { ok: false, error: "Ese horario ya está ocupado" };

    await prisma.$executeRawUnsafe(
      `DELETE FROM "fixed_booking_releases"
       WHERE "fixedBookingId" = $1 AND "date" = $2::date`,
      fixedBookingId,
      date,
    );
    return { ok: true };
  }

  async getPlayerAccount(
    clubId: string,
    userId: string,
  ): Promise<PlayerAccount> {
    const [charge, payment, movements] = await Promise.all([
      prisma.accountMovement.aggregate({
        where: { clubId, userId, type: "CHARGE" },
        _sum: { amount: true },
      }),
      prisma.accountMovement.aggregate({
        where: { clubId, userId, type: "PAYMENT" },
        _sum: { amount: true },
      }),
      prisma.accountMovement.findMany({
        where: { clubId, userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const balance = (charge._sum.amount ?? 0) - (payment._sum.amount ?? 0);
    return {
      balance,
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: m.amount,
        concept: m.concept,
        method: m.method,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async addAccountMovement(
    clubId: string,
    userId: string,
    data: AddMovementData,
  ): Promise<void> {
    await prisma.accountMovement.create({
      data: {
        clubId,
        userId,
        type: data.type,
        amount: data.amount,
        concept: data.concept ?? null,
        method: data.method ?? null,
        productId: data.productId ?? null,
        quantity: data.quantity ?? null,
        unitPrice: data.unitPrice ?? null,
      },
    });
  }

  // --- Catálogo: tipos de producto ---
  async listProductTypes(clubId: string): Promise<ProductType[]> {
    const rows = await prisma.productType.findMany({
      where: { clubId },
      orderBy: { name: "asc" },
    });
    return rows.map((t) => ({ id: t.id, name: t.name, active: t.active }));
  }

  async createProductType(clubId: string, name: string): Promise<void> {
    await prisma.productType.create({ data: { clubId, name } });
  }

  async updateProductType(
    clubId: string,
    id: string,
    name: string,
  ): Promise<void> {
    await prisma.productType.updateMany({ where: { id, clubId }, data: { name } });
  }

  async deleteProductType(
    clubId: string,
    id: string,
  ): Promise<MutationResult> {
    const inUse = await prisma.product.count({ where: { clubId, typeId: id } });
    if (inUse > 0) {
      return { ok: false, error: "El tipo está en uso por productos" };
    }
    await prisma.productType.deleteMany({ where: { id, clubId } });
    return { ok: true };
  }

  // --- Catálogo: productos ---
  async listProducts(clubId: string): Promise<ProductListItem[]> {
    const rows = await prisma.product.findMany({
      where: { clubId },
      include: { type: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      typeId: p.typeId,
      typeName: p.type?.name ?? null,
      cost: p.cost,
      marginPct: p.marginPct,
      price: p.price,
      rounding: p.rounding,
      stock: p.stock,
      isComposite: p.isComposite,
      baseQuantity: p.baseQuantity,
      unit: p.unit,
      photoUrl: p.photoUrl,
      active: p.active,
      sortOrder: p.sortOrder,
      showInPriceMenu: p.showInPriceMenu === true,
      showInClientMenu: p.showInClientMenu === true,
    }));
  }

  async getProduct(
    clubId: string,
    id: string,
  ): Promise<(ProductValues & { photoUrl: string | null }) | null> {
    const p = await prisma.product.findFirst({
      where: { id, clubId },
      include: {
        components: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                unit: true,
                baseQuantity: true,
                cost: true,
              },
            },
          },
        },
      },
    });
    if (!p) return null;
    return {
      name: p.name,
      code: p.code ?? "",
      description: p.description ?? "",
      notes: p.notes ?? "",
      typeId: p.typeId ?? "",
      cost: p.cost,
      marginPct: p.marginPct,
      price: p.price,
      rounding: p.rounding,
      stock: p.stock,
      isComposite: p.isComposite,
      baseQuantity: p.baseQuantity,
      unit: p.unit as ProductValues["unit"],
      active: p.active,
      components: p.components.map((c) => ({
        componentId: c.componentId,
        quantity: c.quantity,
      })),
      photoUrl: p.photoUrl,
    };
  }

  async getSellableProducts(clubId: string): Promise<SellableProduct[]> {
    const rows = await prisma.product.findMany({
      where: { clubId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((p) => ({ id: p.id, name: p.name, price: p.price }));
  }

  async createProduct(
    clubId: string,
    input: ProductValues,
  ): Promise<MutationResult & { id?: string }> {
    const resolved = await resolveProductCostAndComponents(clubId, input);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      const agg = await prisma.product.aggregate({
        where: { clubId },
        _max: { sortOrder: true },
      });
      const sortOrder = (agg._max.sortOrder ?? -1) + 1;
      const created = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            clubId,
            name: input.name,
            code: input.code ? input.code : null,
            description: input.description ? input.description : null,
            notes: input.notes ? input.notes : null,
            typeId: input.typeId ? input.typeId : null,
            cost: resolved.cost,
            marginPct: input.marginPct,
            price: input.price,
            rounding: input.rounding,
            stock: input.stock,
            isComposite: input.isComposite,
            baseQuantity: input.isComposite ? 1 : input.baseQuantity,
            unit: input.isComposite ? "u" : input.unit,
            active: input.active,
            sortOrder,
            showInPriceMenu: false,
            showInClientMenu: false,
          },
        });
        if (resolved.components.length > 0) {
          await tx.productComponent.createMany({
            data: resolved.components.map((c) => ({
              parentId: product.id,
              componentId: c.componentId,
              quantity: c.quantity,
            })),
          });
        }
        return product;
      });
      return { ok: true, id: created.id };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        return { ok: false, error: "Ya existe un producto con ese código" };
      throw e;
    }
  }

  async updateProduct(
    clubId: string,
    id: string,
    input: ProductValues,
  ): Promise<MutationResult> {
    const belongs = await prisma.product.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!belongs) return { ok: false, error: "Producto no encontrado" };
    const resolved = await resolveProductCostAndComponents(clubId, input, id);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            name: input.name,
            code: input.code ? input.code : null,
            description: input.description ? input.description : null,
            notes: input.notes ? input.notes : null,
            typeId: input.typeId ? input.typeId : null,
            cost: resolved.cost,
            marginPct: input.marginPct,
            price: input.price,
            rounding: input.rounding,
            stock: input.stock,
            isComposite: input.isComposite,
            baseQuantity: input.isComposite ? 1 : input.baseQuantity,
            unit: input.isComposite ? "u" : input.unit,
            active: input.active,
          },
        });
        await tx.productComponent.deleteMany({ where: { parentId: id } });
        if (resolved.components.length > 0) {
          await tx.productComponent.createMany({
            data: resolved.components.map((c) => ({
              parentId: id,
              componentId: c.componentId,
              quantity: c.quantity,
            })),
          });
        }
      });
      return { ok: true };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        return { ok: false, error: "Ya existe un producto con ese código" };
      throw e;
    }
  }

  async setProductActive(
    clubId: string,
    id: string,
    active: boolean,
  ): Promise<void> {
    await prisma.product.updateMany({ where: { id, clubId }, data: { active } });
  }

  async setProductShowInPriceMenu(
    clubId: string,
    id: string,
    showInPriceMenu: boolean,
  ): Promise<void> {
    await prisma.product.updateMany({
      where: { id, clubId },
      data: { showInPriceMenu },
    });
  }

  async setProductShowInClientMenu(
    clubId: string,
    id: string,
    showInClientMenu: boolean,
  ): Promise<void> {
    await prisma.product.updateMany({
      where: { id, clubId },
      data: { showInClientMenu },
    });
  }

  async reorderProducts(clubId: string, orderedIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.product.updateMany({
          where: { id, clubId },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  async setProductPhoto(
    clubId: string,
    id: string,
    url: string | null,
  ): Promise<void> {
    await prisma.product.updateMany({
      where: { id, clubId },
      data: { photoUrl: url },
    });
  }

  async sellProduct(
    clubId: string,
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<MutationResult> {
    const product = await prisma.product.findFirst({
      where: { id: productId, clubId, active: true },
    });
    if (!product) return { ok: false, error: "Producto no encontrado" };
    if (!(quantity > 0)) return { ok: false, error: "Cantidad inválida" };
    const qty = quantity;
    await prisma.accountMovement.create({
      data: {
        clubId,
        userId,
        type: "CHARGE",
        amount: Math.round(product.price * qty),
        concept:
          qty !== 1 ? `${product.name} x${formatQuantity(qty)}` : product.name,
        productId: product.id,
        quantity: qty,
        unitPrice: product.price,
      },
    });
    return { ok: true };
  }
}
