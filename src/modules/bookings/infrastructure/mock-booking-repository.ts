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
import { EMPTY_PHONE_FIELDS } from "../domain/new-player-schema";
import type {
  AddMovementData,
  AccountMovement,
  PlayerAccount,
} from "@/modules/accounts/domain/types";
import {
  expandFixedBookings,
  generateTimeSlots,
  timeToMinutes,
} from "../domain/rules";
import { addDaysISO, todayISO } from "@/lib/date";
import { formatQuantity } from "@/lib/quantity";

// -----------------------------------------------------------------------------
// Repositorio en memoria para desarrollo/demo (sin base de datos).
// El estado es MUTABLE y persiste durante la vida del proceso del server.
// Se reemplaza por Prisma cuando hay DATABASE_URL (ver repository.ts).
// -----------------------------------------------------------------------------

interface ClubRecord {
  club: ClubInfo;
  settings: BookingSettings;
  courts: Court[];
  players: PlayerRef[];
  categories: string[];
  stored: Booking[]; // reservas creadas en runtime
  fixed: (FixedBookingTemplate & { active: boolean })[];
  movements: (AccountMovement & { userId: string })[];
  productTypes: ProductType[];
  products: (ProductValues & {
    id: string;
    photoUrl: string | null;
    active: boolean;
  })[];
}

const DEFAULT_CATEGORIES = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "8va"];

/// Precio (centavos) del producto que define el turno, dentro de un club.
function turnoPriceOf(
  record: ClubRecord,
  turnoProductId: string | null,
): number {
  if (!turnoProductId) return 0;
  return record.products.find((p) => p.id === turnoProductId)?.price ?? 0;
}

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

const DEFAULT_PLAYERS: PlayerRef[] = [
  { id: "demo-owner", name: "Dueño Demo", gender: "MALE" },
  { id: "demo-p1", name: "Martín Pérez", gender: "MALE" },
  { id: "demo-p2", name: "Lucía Gómez", gender: "FEMALE" },
  { id: "demo-p3", name: "Diego Fernández", gender: "MALE" },
  { id: "demo-p4", name: "Sofía Ramírez", gender: "FEMALE" },
  { id: "demo-p5", name: "Nicolás Torres", gender: "MALE" },
  { id: "demo-p6", name: "Valentina Ruiz", gender: "FEMALE" },
];

const store = new Map<string, ClubRecord>();

function defaultCourts(count = 4): Court[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `court-${i + 1}`,
    name: `Cancha ${i + 1}`,
    active: true,
    order: i + 1,
  }));
}

function getOrCreateRecord(slug: string): ClubRecord {
  let record = store.get(slug);
  if (!record) {
    record = {
      club: {
        id: slug,
        name: slug === "club-demo" ? "Club Demo Pádel" : `Club ${slug}`,
        slug,
        timezone: "America/Argentina/Buenos_Aires",
        currency: "ARS",
      },
      settings: { ...DEFAULT_SETTINGS },
      courts: defaultCourts(),
      players: [...DEFAULT_PLAYERS],
      categories: [...DEFAULT_CATEGORIES],
      stored: [],
      fixed: [],
      movements: [],
      productTypes: [],
      products: [],
    };
    store.set(slug, record);
  }
  return record;
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/// Reservas demo determinísticas por día (para que el calendario no esté vacío).
function buildDemoBookings(
  courts: Court[],
  settings: BookingSettings,
  date: string,
): Booking[] {
  const slots = generateTimeSlots(settings);
  const bookings: Booking[] = [];

  for (const court of courts) {
    for (const slot of slots) {
      const seed = hash(`${date}-${court.id}-${slot}`);
      if (seed % 10 >= 4) continue; // ~40% ocupación

      const isFixed = seed % 5 === 0;
      const isReserved = seed % 3 !== 0;
      const paymentSeed = seed % 4;
      const responsible = DEFAULT_PLAYERS[seed % DEFAULT_PLAYERS.length];
      const extra = DEFAULT_PLAYERS[(seed + 3) % DEFAULT_PLAYERS.length];

      bookings.push({
        id: `demo-${court.id}-${date}-${slot}`,
        courtId: court.id,
        date,
        startTime: slot,
        durationMin: settings.slotDurationMin,
        type: isFixed ? "FIJO" : "NO_FIJO",
        status: isReserved ? "RESERVADO" : "PRE_RESERVA",
        paymentStatus:
          paymentSeed === 0 ? "PAID" : paymentSeed === 1 ? "PARTIAL" : "UNPAID",
        price: 0,
        impacted: false,
        responsible: { id: responsible.id, name: responsible.name },
        players: [
          { id: responsible.id, name: responsible.name },
          { id: extra.id, name: extra.name },
        ],
      });
    }
  }

  return bookings;
}

export class MockBookingRepository implements BookingRepository {
  async getClubBySlug(slug: string): Promise<ClubInfo | null> {
    return getOrCreateRecord(slug).club;
  }

  async getCourts(clubId: string): Promise<Court[]> {
    return [...getOrCreateRecord(clubId).courts].sort(
      (a, b) => a.order - b.order,
    );
  }

  async getSettings(clubId: string): Promise<BookingSettings> {
    const record = getOrCreateRecord(clubId);
    return {
      ...record.settings,
      bookingPrice: turnoPriceOf(record, record.settings.turnoProductId),
    };
  }

  async getClubCategories(clubId: string): Promise<string[]> {
    return [...getOrCreateRecord(clubId).categories];
  }

  async saveCategories(
    clubId: string,
    categories: string[],
  ): Promise<string[]> {
    const record = getOrCreateRecord(clubId);
    record.categories = [...categories];
    return [...record.categories];
  }

  async getPlayers(clubId: string): Promise<PlayerRef[]> {
    return [...getOrCreateRecord(clubId).players];
  }

  async listPlayers(clubId: string): Promise<PlayerListItem[]> {
    const record = getOrCreateRecord(clubId);
    const balanceOf = (userId: string) =>
      record.movements
        .filter((m) => m.userId === userId)
        .reduce((a, m) => a + (m.type === "CHARGE" ? m.amount : -m.amount), 0);
    return record.players
      .map((p) => ({
        id: p.id,
        fullName: p.name,
        phone: null,
        category: null,
        courtPosition: null,
        ranking: null,
        accumulatedPoints: 0,
        photoUrl: null,
        balance: balanceOf(p.id),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getPlayerProfile(
    clubId: string,
    userId: string,
  ): Promise<NewPlayerValues | null> {
    const record = getOrCreateRecord(clubId);
    const p = record.players.find((x) => x.id === userId);
    if (!p) return null;
    const [firstName, ...rest] = p.name.split(" ");
    return {
      firstName: firstName ?? p.name,
      lastName: rest.join(" "),
      ...EMPTY_PHONE_FIELDS,
      email: "",
      gender: "",
      birthDate: "",
      city: "",
      address: "",
      country: "",
      category: "",
      courtPosition: "",
      ranking: null,
      accumulatedPoints: 0,
    };
  }

  async createPlayer(
    clubId: string,
    input: NewPlayerValues,
  ): Promise<PlayerRef> {
    const record = getOrCreateRecord(clubId);
    const player: PlayerRef = {
      id: `pl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `${input.firstName} ${input.lastName}`.trim(),
      gender: input.gender || null,
    };
    record.players.push(player);
    return player;
  }

  async updatePlayer(
    clubId: string,
    userId: string,
    input: NewPlayerValues,
  ): Promise<void> {
    const record = getOrCreateRecord(clubId);
    const p = record.players.find((x) => x.id === userId);
    if (p) p.name = `${input.firstName} ${input.lastName}`.trim();
  }

  async deletePlayer(
    clubId: string,
    userId: string,
  ): Promise<MutationResult> {
    const record = getOrCreateRecord(clubId);
    const before = record.players.length;
    record.players = record.players.filter((p) => p.id !== userId);
    return record.players.length < before
      ? { ok: true }
      : { ok: false, error: "Jugador no encontrado en este club" };
  }

  async setPlayerPhoto(): Promise<void> {
    // El mock no almacena fotos; se persisten con Prisma/Supabase.
  }

  async getBookingsForDate(clubId: string, date: string): Promise<Booking[]> {
    const record = getOrCreateRecord(clubId);
    const activeCourts = record.courts.filter((c) => c.active);
    const demo = buildDemoBookings(activeCourts, record.settings, date);
    const stored = record.stored.filter((b) => b.date === date);
    const fixed = expandFixedBookings(
      record.fixed.filter((f) => f.active),
      [date],
    );
    return [...demo, ...stored, ...fixed].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );
  }

  async getBookingsForRange(
    clubId: string,
    startDate: string,
    endDate: string,
  ): Promise<Booking[]> {
    const result: Booking[] = [];
    let cursor = startDate;
    // hasta 60 días como salvaguarda
    for (let i = 0; i < 60 && cursor <= endDate; i++) {
      result.push(...(await this.getBookingsForDate(clubId, cursor)));
      cursor = addDaysISO(cursor, 1);
    }
    return result;
  }

  async updateSettings(
    clubId: string,
    settings: WritableBookingSettings,
  ): Promise<BookingSettings> {
    const record = getOrCreateRecord(clubId);
    const bookingPrice = turnoPriceOf(record, settings.turnoProductId);
    record.settings = { ...settings, bookingPrice };
    return { ...record.settings };
  }

  async saveCourts(clubId: string, courts: CourtInput[]): Promise<Court[]> {
    const record = getOrCreateRecord(clubId);
    record.courts = courts.map((c, index) => ({
      id: c.id ?? `court-${Date.now()}-${index}`,
      name: c.name,
      active: c.active,
      order: index + 1,
    }));
    return [...record.courts];
  }

  async createBooking(
    clubId: string,
    data: CreateBookingData,
  ): Promise<Booking> {
    const record = getOrCreateRecord(clubId);
    const nameOf = (id: string) =>
      record.players.find((p) => p.id === id)?.name ?? "Jugador";

    const booking: Booking = {
      id: `bk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      courtId: data.courtId,
      date: data.date,
      startTime: data.startTime,
      durationMin: data.durationMin,
      type: data.type,
      status: data.status,
      paymentStatus: data.paymentStatus,
      price: data.price,
      impacted: false,
      responsible: { id: data.responsibleId, name: nameOf(data.responsibleId) },
      players: data.playerIds.map((id) => ({ id, name: nameOf(id) })),
    };
    record.stored.push(booking);
    return booking;
  }

  async updateBooking(
    clubId: string,
    bookingId: string,
    data: UpdateBookingData,
  ): Promise<void> {
    const record = getOrCreateRecord(clubId);
    const b = record.stored.find((x) => x.id === bookingId);
    if (!b) return;
    const nameOf = (id: string) =>
      record.players.find((p) => p.id === id)?.name ?? "Jugador";
    b.type = data.type;
    b.responsible = { id: data.responsibleId, name: nameOf(data.responsibleId) };
    b.players = data.playerIds.map((id) => ({ id, name: nameOf(id) }));
    b.status = data.status;
    b.paymentStatus = data.paymentStatus;
    b.price = data.price;
  }

  async confirmBooking(clubId: string, bookingId: string): Promise<void> {
    const record = getOrCreateRecord(clubId);
    const b = record.stored.find((x) => x.id === bookingId);
    if (b) b.status = "RESERVADO";
  }

  async cancelBooking(clubId: string, bookingId: string): Promise<void> {
    const record = getOrCreateRecord(clubId);
    record.stored = record.stored.filter((x) => x.id !== bookingId);
  }

  async setBookingStatus(
    clubId: string,
    bookingId: string,
    status: "PRE_RESERVA" | "RESERVADO",
  ): Promise<void> {
    const record = getOrCreateRecord(clubId);
    const b = record.stored.find((x) => x.id === bookingId);
    if (b) b.status = status;
  }

  async setBookingPayment(
    clubId: string,
    bookingId: string,
    status: PaymentStatus,
  ): Promise<void> {
    const record = getOrCreateRecord(clubId);
    const b = record.stored.find((x) => x.id === bookingId);
    if (b) b.paymentStatus = status;
  }

  async getActiveFixedBookings(
    clubId: string,
  ): Promise<FixedBookingTemplate[]> {
    return getOrCreateRecord(clubId)
      .fixed.filter((f) => f.active)
      .map(({ active: _active, ...t }) => t);
  }

  async createFixedBooking(
    clubId: string,
    input: CreateFixedBookingInput,
  ): Promise<void> {
    const record = getOrCreateRecord(clubId);
    const responsible = record.players.find(
      (p) => p.id === input.responsibleId,
    ) ?? { id: input.responsibleId, name: "Jugador" };
    record.fixed.push({
      id: `fx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      courtId: input.courtId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      durationMin: input.durationMin,
      responsible,
      startDate: todayISO(),
      active: true,
    });
  }

  async cancelFixedBooking(
    clubId: string,
    fixedBookingId: string,
  ): Promise<void> {
    const record = getOrCreateRecord(clubId);
    const f = record.fixed.find((x) => x.id === fixedBookingId);
    if (f) f.active = false;
  }

  async getPlayerAccount(
    clubId: string,
    userId: string,
  ): Promise<PlayerAccount> {
    const record = getOrCreateRecord(clubId);
    const mine = record.movements.filter((m) => m.userId === userId);
    const balance = mine.reduce(
      (acc, m) => acc + (m.type === "CHARGE" ? m.amount : -m.amount),
      0,
    );
    const movements = [...mine]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 30)
      .map(({ userId: _userId, ...m }) => m);
    return { balance, movements };
  }

  async addAccountMovement(
    clubId: string,
    userId: string,
    data: AddMovementData,
  ): Promise<void> {
    const record = getOrCreateRecord(clubId);
    record.movements.push({
      id: `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: data.type,
      amount: data.amount,
      concept: data.concept ?? null,
      method: data.method ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async listProductTypes(clubId: string): Promise<ProductType[]> {
    return [...getOrCreateRecord(clubId).productTypes].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async createProductType(clubId: string, name: string): Promise<void> {
    getOrCreateRecord(clubId).productTypes.push({
      id: `pt-${Date.now()}`,
      name,
      active: true,
    });
  }

  async updateProductType(
    clubId: string,
    id: string,
    name: string,
  ): Promise<void> {
    const t = getOrCreateRecord(clubId).productTypes.find((x) => x.id === id);
    if (t) t.name = name;
  }

  async deleteProductType(
    clubId: string,
    id: string,
  ): Promise<MutationResult> {
    const record = getOrCreateRecord(clubId);
    if (record.products.some((p) => p.typeId === id)) {
      return { ok: false, error: "El tipo está en uso por productos" };
    }
    record.productTypes = record.productTypes.filter((x) => x.id !== id);
    return { ok: true };
  }

  async listProducts(clubId: string): Promise<ProductListItem[]> {
    const record = getOrCreateRecord(clubId);
    const typeName = (id?: string) =>
      record.productTypes.find((t) => t.id === id)?.name ?? null;
    return record.products
      .map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code || null,
        typeId: p.typeId || null,
        typeName: p.typeId ? typeName(p.typeId) : null,
        cost: p.cost,
        marginPct: p.marginPct,
        price: p.price,
        rounding: p.rounding,
        stock: p.stock,
        isComposite: p.isComposite,
        photoUrl: p.photoUrl,
        active: p.active,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProduct(
    clubId: string,
    id: string,
  ): Promise<(ProductValues & { photoUrl: string | null }) | null> {
    const p = getOrCreateRecord(clubId).products.find((x) => x.id === id);
    if (!p) return null;
    const { id: _id, ...values } = p;
    return values;
  }

  async getSellableProducts(clubId: string): Promise<SellableProduct[]> {
    return getOrCreateRecord(clubId)
      .products.filter((p) => p.active)
      .map((p) => ({ id: p.id, name: p.name, price: p.price }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createProduct(
    clubId: string,
    input: ProductValues,
  ): Promise<MutationResult & { id?: string }> {
    const record = getOrCreateRecord(clubId);
    if (input.code && record.products.some((p) => p.code === input.code)) {
      return { ok: false, error: "Ya existe un producto con ese código" };
    }
    const id = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    record.products.push({ ...input, id, photoUrl: null });
    return { ok: true, id };
  }

  async updateProduct(
    clubId: string,
    id: string,
    input: ProductValues,
  ): Promise<MutationResult> {
    const record = getOrCreateRecord(clubId);
    const p = record.products.find((x) => x.id === id);
    if (!p) return { ok: false, error: "Producto no encontrado" };
    if (
      input.code &&
      record.products.some((x) => x.code === input.code && x.id !== id)
    ) {
      return { ok: false, error: "Ya existe un producto con ese código" };
    }
    Object.assign(p, input);
    return { ok: true };
  }

  async setProductActive(
    clubId: string,
    id: string,
    active: boolean,
  ): Promise<void> {
    const p = getOrCreateRecord(clubId).products.find((x) => x.id === id);
    if (p) p.active = active;
  }

  async setProductPhoto(): Promise<void> {
    // El mock no almacena fotos de productos.
  }

  async sellProduct(
    clubId: string,
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<MutationResult> {
    const record = getOrCreateRecord(clubId);
    const p = record.products.find((x) => x.id === productId && x.active);
    if (!p) return { ok: false, error: "Producto no encontrado" };
    if (!(quantity > 0)) return { ok: false, error: "Cantidad inválida" };
    const qty = quantity;
    record.movements.push({
      id: `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: "CHARGE",
      amount: Math.round(p.price * qty),
      concept: qty !== 1 ? `${p.name} x${formatQuantity(qty)}` : p.name,
      method: null,
      createdAt: new Date().toISOString(),
    });
    return { ok: true };
  }
}
