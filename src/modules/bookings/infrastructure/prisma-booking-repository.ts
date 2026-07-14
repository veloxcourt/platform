import { prisma } from "@/lib/prisma";
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
import type {
  Booking,
  BookingSettings,
  WritableBookingSettings,
  ClubInfo,
  Court,
  CreateBookingData,
  CreateFixedBookingInput,
  FixedBookingTemplate,
  PaymentStatus,
  PlayerListItem,
  PlayerRef,
  UpdateBookingData,
} from "../domain/types";
import type { CourtInput } from "../domain/settings-schema";
import type { NewPlayerValues } from "../domain/new-player-schema";
import { playerPhoneToE164 } from "../domain/new-player-schema";
import { splitPhoneForForm } from "@/lib/phone";
import type {
  AddMovementData,
  PlayerAccount,
} from "@/modules/accounts/domain/types";
import { expandFixedBookings } from "../domain/rules";
import { addDaysISO } from "@/lib/date";
import { formatQuantity } from "@/lib/quantity";

const DEFAULT_SETTINGS: BookingSettings = {
  openTime: "08:00",
  closeTime: "23:00",
  slotDurationMin: 90,
  intervalMin: 0,
  preReservationMin: 15,
  requirePrePayment: false,
  turnoProductId: null,
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

/// Convierte "YYYY-MM-DD" a un Date UTC a medianoche (para columnas `@db.Date`).
function toDbDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

/// Forma del booking con relaciones incluidas (para el mapeo a dominio).
type BookingRow = {
  id: string;
  courtId: string;
  date: Date;
  startTime: string;
  durationMin: number;
  type: "FIJO" | "NO_FIJO";
  status: "PRE_RESERVA" | "RESERVADO" | "CANCELLED";
  paymentStatus: PaymentStatus;
  price: number;
  chargeMovementId: string | null;
  responsible: { id: string; fullName: string };
  players: { user: { id: string; fullName: string } }[];
};

function mapBooking(b: BookingRow): Booking {
  return {
    id: b.id,
    courtId: b.courtId,
    date: b.date.toISOString().slice(0, 10),
    startTime: b.startTime,
    durationMin: b.durationMin,
    type: b.type,
    status: b.status as "PRE_RESERVA" | "RESERVADO",
    paymentStatus: b.paymentStatus,
    price: b.price,
    impacted: b.chargeMovementId != null,
    responsible: { id: b.responsible.id, name: b.responsible.fullName },
    players: b.players.map((p) => ({ id: p.user.id, name: p.user.fullName })),
  };
}

const BOOKING_INCLUDE = {
  responsible: true,
  players: { include: { user: true } },
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
    const s = await prisma.bookingSettings.findUnique({ where: { clubId } });
    if (!s) return { ...DEFAULT_SETTINGS };
    return {
      openTime: s.openTime,
      closeTime: s.closeTime,
      slotDurationMin: s.slotDurationMin,
      intervalMin: s.intervalMin,
      preReservationMin: s.preReservationMin,
      requirePrePayment: s.requirePrePayment,
      turnoProductId: s.turnoProductId,
      bookingPrice: await resolveTurnoPrice(clubId, s.turnoProductId),
    };
  }

  async getPlayers(clubId: string): Promise<PlayerRef[]> {
    const users = await prisma.user.findMany({
      where: { memberships: { some: { clubId } } },
      orderBy: { fullName: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.fullName,
      gender: u.gender,
    }));
  }

  async listPlayers(clubId: string): Promise<PlayerListItem[]> {
    const [users, grouped] = await Promise.all([
      prisma.user.findMany({
        where: { memberships: { some: { clubId } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { fullName: "asc" }],
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

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      phone: u.phone,
      category: u.category ? normalizeCategoryLevel(u.category) : null,
      courtPosition: u.courtPosition,
      ranking: u.ranking,
      accumulatedPoints: u.accumulatedPoints,
      photoUrl: u.photoUrl,
      balance: balanceMap.get(u.id) ?? 0,
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
      where: { id: userId, memberships: { some: { clubId } } },
    });
    if (!u) return null;
    const phone = splitPhoneForForm(u.phone);
    return {
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      phoneCountryDial: phone.dial,
      phoneLocal: phone.local,
      email: u.email ?? "",
      gender: u.gender ?? "",
      birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : "",
      city: u.city ?? "",
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
        address: input.address ? input.address : null,
        country: input.country ? input.country : null,
        category: input.category
          ? normalizeCategoryLevel(input.category)
          : null,
        courtPosition: input.courtPosition ? input.courtPosition : null,
        ranking: input.ranking ?? null,
        accumulatedPoints: input.accumulatedPoints ?? 0,
        memberships: { create: { clubId, role: "PLAYER" } },
      },
    });
    return { id: user.id, name: user.fullName, gender: user.gender };
  }

  async updatePlayer(
    clubId: string,
    userId: string,
    input: NewPlayerValues,
  ): Promise<void> {
    const belongs = await prisma.membership.findFirst({
      where: { clubId, userId },
      select: { id: true },
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
      where: { id: userId, memberships: { some: { clubId } } },
      data: { photoUrl: url },
    });
  }

  async getBookingsForDate(clubId: string, date: string): Promise<Booking[]> {
    const [rows, templates] = await Promise.all([
      prisma.booking.findMany({
        where: { clubId, date: toDbDate(date), status: { not: "CANCELLED" } },
        include: BOOKING_INCLUDE,
      }),
      this.getActiveFixedBookings(clubId),
    ]);
    return [...rows.map(mapBooking), ...expandFixedBookings(templates, [date])];
  }

  async getBookingsForRange(
    clubId: string,
    startDate: string,
    endDate: string,
  ): Promise<Booking[]> {
    const [rows, templates] = await Promise.all([
      prisma.booking.findMany({
        where: {
          clubId,
          date: { gte: toDbDate(startDate), lte: toDbDate(endDate) },
          status: { not: "CANCELLED" },
        },
        include: BOOKING_INCLUDE,
      }),
      this.getActiveFixedBookings(clubId),
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
    const s = await prisma.bookingSettings.upsert({
      where: { clubId },
      update: settings,
      create: { clubId, ...settings },
    });
    return {
      openTime: s.openTime,
      closeTime: s.closeTime,
      slotDurationMin: s.slotDurationMin,
      intervalMin: s.intervalMin,
      preReservationMin: s.preReservationMin,
      requirePrePayment: s.requirePrePayment,
      turnoProductId: s.turnoProductId,
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
  ): Promise<FixedBookingTemplate[]> {
    const rows = await prisma.fixedBooking.findMany({
      where: { clubId, active: true },
      include: { responsible: true },
    });
    return rows.map((f) => ({
      id: f.id,
      courtId: f.courtId,
      dayOfWeek: f.dayOfWeek,
      startTime: f.startTime,
      durationMin: f.durationMin,
      responsible: { id: f.responsible.id, name: f.responsible.fullName },
      startDate: f.createdAt.toISOString().slice(0, 10),
    }));
  }

  async createFixedBooking(
    clubId: string,
    input: CreateFixedBookingInput,
  ): Promise<void> {
    await prisma.fixedBooking.create({
      data: {
        clubId,
        courtId: input.courtId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        durationMin: input.durationMin,
        responsibleId: input.responsibleId,
      },
    });
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
      orderBy: { name: "asc" },
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
      photoUrl: p.photoUrl,
      active: p.active,
    }));
  }

  async getProduct(
    clubId: string,
    id: string,
  ): Promise<(ProductValues & { photoUrl: string | null }) | null> {
    const p = await prisma.product.findFirst({ where: { id, clubId } });
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
      active: p.active,
      photoUrl: p.photoUrl,
    };
  }

  async getSellableProducts(clubId: string): Promise<SellableProduct[]> {
    const rows = await prisma.product.findMany({
      where: { clubId, active: true },
      orderBy: { name: "asc" },
    });
    return rows.map((p) => ({ id: p.id, name: p.name, price: p.price }));
  }

  async createProduct(
    clubId: string,
    input: ProductValues,
  ): Promise<MutationResult & { id?: string }> {
    try {
      const created = await prisma.product.create({
        data: {
          clubId,
          name: input.name,
          code: input.code ? input.code : null,
          description: input.description ? input.description : null,
          notes: input.notes ? input.notes : null,
          typeId: input.typeId ? input.typeId : null,
          cost: input.cost,
          marginPct: input.marginPct,
          price: input.price,
          rounding: input.rounding,
          stock: input.stock,
          isComposite: input.isComposite,
          active: input.active,
        },
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
    try {
      await prisma.product.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code ? input.code : null,
          description: input.description ? input.description : null,
          notes: input.notes ? input.notes : null,
          typeId: input.typeId ? input.typeId : null,
          cost: input.cost,
          marginPct: input.marginPct,
          price: input.price,
          rounding: input.rounding,
          stock: input.stock,
          isComposite: input.isComposite,
          active: input.active,
        },
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
