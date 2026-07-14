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
import type {
  AddMovementData,
  PlayerAccount,
} from "@/modules/accounts/domain/types";
import type {
  ProductListItem,
  ProductType,
  SellableProduct,
} from "@/modules/catalog/domain/types";
import type { ProductValues } from "@/modules/catalog/domain/product-schema";

export type MutationResult = { ok: boolean; error?: string };

/// Contrato de acceso a datos del módulo de Turnos.
/// La capa de aplicación depende de esta interfaz, no de una implementación
/// concreta (Prisma, mock, etc.). Todas las operaciones están acotadas por club.
export interface BookingRepository {
  // Lectura
  getClubBySlug(slug: string): Promise<ClubInfo | null>;
  /// Devuelve todas las canchas del club (activas e inactivas).
  getCourts(clubId: string): Promise<Court[]>;
  getSettings(clubId: string): Promise<BookingSettings>;
  getClubCategories(clubId: string): Promise<string[]>;
  saveCategories(clubId: string, categories: string[]): Promise<string[]>;
  getPlayers(clubId: string): Promise<PlayerRef[]>;
  listPlayers(clubId: string): Promise<PlayerListItem[]>;
  getPlayerProfile(
    clubId: string,
    userId: string,
  ): Promise<NewPlayerValues | null>;
  createPlayer(clubId: string, input: NewPlayerValues): Promise<PlayerRef>;
  updatePlayer(
    clubId: string,
    userId: string,
    input: NewPlayerValues,
  ): Promise<void>;
  deletePlayer(clubId: string, userId: string): Promise<MutationResult>;
  setPlayerPhoto(
    clubId: string,
    userId: string,
    url: string | null,
  ): Promise<void>;
  getBookingsForDate(clubId: string, date: string): Promise<Booking[]>;
  getBookingsForRange(
    clubId: string,
    startDate: string,
    endDate: string,
  ): Promise<Booking[]>;

  // Escritura (configuración)
  updateSettings(
    clubId: string,
    settings: WritableBookingSettings,
  ): Promise<BookingSettings>;
  /// Reemplaza el conjunto de canchas del club a partir de la configuración.
  saveCourts(clubId: string, courts: CourtInput[]): Promise<Court[]>;

  // Escritura (reservas)
  createBooking(clubId: string, data: CreateBookingData): Promise<Booking>;
  updateBooking(
    clubId: string,
    bookingId: string,
    data: UpdateBookingData,
  ): Promise<void>;
  confirmBooking(clubId: string, bookingId: string): Promise<void>;
  cancelBooking(clubId: string, bookingId: string): Promise<void>;
  setBookingStatus(
    clubId: string,
    bookingId: string,
    status: "PRE_RESERVA" | "RESERVADO",
  ): Promise<void>;
  setBookingPayment(
    clubId: string,
    bookingId: string,
    status: PaymentStatus,
  ): Promise<void>;

  // Turnos fijos (plantillas recurrentes)
  getActiveFixedBookings(clubId: string): Promise<FixedBookingTemplate[]>;
  createFixedBooking(
    clubId: string,
    input: CreateFixedBookingInput,
  ): Promise<void>;
  cancelFixedBooking(clubId: string, fixedBookingId: string): Promise<void>;

  // Cuenta corriente del jugador
  getPlayerAccount(clubId: string, userId: string): Promise<PlayerAccount>;
  addAccountMovement(
    clubId: string,
    userId: string,
    data: AddMovementData,
  ): Promise<void>;

  // Catálogo: tipos de producto
  listProductTypes(clubId: string): Promise<ProductType[]>;
  createProductType(clubId: string, name: string): Promise<void>;
  updateProductType(clubId: string, id: string, name: string): Promise<void>;
  deleteProductType(clubId: string, id: string): Promise<MutationResult>;

  // Catálogo: productos
  listProducts(clubId: string): Promise<ProductListItem[]>;
  getProduct(
    clubId: string,
    id: string,
  ): Promise<(ProductValues & { photoUrl: string | null }) | null>;
  getSellableProducts(clubId: string): Promise<SellableProduct[]>;
  createProduct(
    clubId: string,
    input: ProductValues,
  ): Promise<MutationResult & { id?: string }>;
  updateProduct(
    clubId: string,
    id: string,
    input: ProductValues,
  ): Promise<MutationResult>;
  setProductActive(
    clubId: string,
    id: string,
    active: boolean,
  ): Promise<void>;
  setProductPhoto(
    clubId: string,
    id: string,
    url: string | null,
  ): Promise<void>;

  // Venta: cargar un producto a la cuenta del jugador (COMPRA con snapshot)
  sellProduct(
    clubId: string,
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<MutationResult>;
}
