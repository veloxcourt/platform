// Tipos de dominio del módulo de Turnos.
// Independientes de la infraestructura (Prisma/Supabase) y de la UI.

export type BookingType = "FIJO" | "NO_FIJO";
export type BookingStatus = "PRE_RESERVA" | "RESERVADO" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

/// Estado visible de una celda del calendario.
/// DISPONIBLE no es un registro: representa la ausencia de reserva en el slot.
export type SlotStatus = "DISPONIBLE" | "PRE_RESERVA" | "RESERVADO";

export interface Court {
  id: string;
  name: string;
  active: boolean;
  order: number;
}

export interface BookingSettings {
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
  slotDurationMin: number;
  intervalMin: number;
  preReservationMin: number;
  requirePrePayment: boolean;
  turnoProductId: string | null; // producto del catálogo que define el precio
  /// Primera línea del texto que se copia para WhatsApp.
  availabilityIntro: string;
  bookingPrice: number; // precio efectivo del turno (derivado del producto), solo lectura
}

/// Configuración editable (el precio no se edita; se deriva del producto elegido).
export type WritableBookingSettings = Omit<BookingSettings, "bookingPrice">;

import type { Gender } from "./new-player-schema";

export interface PlayerRef {
  id: string;
  name: string;
  gender?: Gender | null;
  city?: string | null;
}

/// Item del listado de jugadores del club (con saldo de cuenta).
export interface PlayerListItem {
  id: string;
  fullName: string;
  phone: string | null;
  instagram: string | null;
  gender: Gender | null;
  city: string | null;
  category: string | null;
  courtPosition: string | null;
  ranking: number | null;
  accumulatedPoints: number;
  photoUrl: string | null;
  balance: number;
  inviteSentAt: string | null;
  inviteForTournamentId: string | null;
  inviteNote: string | null;
}

export interface Booking {
  id: string;
  courtId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  durationMin: number;
  type: BookingType;
  status: Exclude<BookingStatus, "CANCELLED">;
  paymentStatus: PaymentStatus;
  price: number;
  impacted: boolean; // si ya se impactó en la cuenta del responsable
  responsible: PlayerRef;
  players: PlayerRef[];
}

export interface ClubInfo {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
}

/// Resultado de armar la agenda de un día para un club.
export interface DaySchedule {
  club: ClubInfo;
  date: string; // "YYYY-MM-DD"
  settings: BookingSettings;
  courts: Court[];
  slots: string[]; // horarios "HH:mm" generados según settings
  bookings: Booking[];
  /// Turnos fijos liberados ese día: el horario queda libre, la serie sigue.
  releasedSlots: ReleasedFixedSlot[];
  players: PlayerRef[]; // jugadores del club (para crear reservas)
  categories: string[]; // categorías de jugadores del club
}

/// Datos ya resueltos para crear una reserva (la capa de aplicación completa
/// duración, estado, vencimiento, etc. a partir de la configuración del club).
export interface CreateBookingData {
  courtId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  durationMin: number;
  type: BookingType;
  status: Exclude<BookingStatus, "CANCELLED">;
  paymentStatus: PaymentStatus;
  price: number;
  responsibleId: string;
  playerIds: string[];
  expiresAt: string | null; // ISO
  createdById: string;
}

/// Plantilla de turno fijo: se repite todas las semanas en el mismo día/hora/cancha.
export interface FixedBookingTemplate {
  id: string;
  courtId: string;
  dayOfWeek: number; // 0 (dom) .. 6 (sáb)
  startTime: string; // "HH:mm"
  durationMin: number;
  responsible: PlayerRef;
  /// Jugadores en cancha. Si playersSet es false y esta lista está vacía,
  /// el calendario muestra al responsable.
  players: PlayerRef[];
  playersSet: boolean;
  startDate: string; // "YYYY-MM-DD" desde cuándo aplica
  releasedDates: string[]; // "YYYY-MM-DD" en las que el dueño no lo usa
}

/// Una fecha de un turno fijo que quedó libre sin cancelar la serie.
export interface ReleasedFixedSlot {
  fixedBookingId: string;
  courtId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  durationMin: number;
  responsible: PlayerRef;
}

/// Datos para crear una plantilla de turno fijo.
export interface CreateFixedBookingInput {
  courtId: string;
  dayOfWeek: number;
  startTime: string;
  durationMin: number;
  responsibleId: string;
  playerIds: string[];
}

/// Edición de un turno fijo. Aplica a todas las semanas de la serie.
export interface UpdateFixedBookingData {
  responsibleId: string;
  playerIds: string[];
}

/// Datos para editar una reserva existente (tipo, responsable, jugadores, estado, pago).
export interface UpdateBookingData {
  type: BookingType;
  responsibleId: string;
  playerIds: string[];
  status: Exclude<BookingStatus, "CANCELLED">;
  paymentStatus: PaymentStatus;
  price: number;
}

/// Columna de un día en la vista semanal.
export interface DayColumn {
  date: string; // "YYYY-MM-DD"
  dow: number; // 0 (dom) .. 6 (sáb)
  label: string;
  isWeekend: boolean;
}

/// Agenda semanal: días, horarios, canchas activas y reservas de la semana.
/// La grilla se arma en el cliente (día × cancha) mostrando el responsable.
export interface WeekSchedule {
  club: ClubInfo;
  weekStart: string; // lunes "YYYY-MM-DD"
  days: DayColumn[];
  slots: string[];
  courts: Court[]; // canchas activas
  bookings: Booking[]; // reservas de la semana
  releasedSlots: ReleasedFixedSlot[];
  players: PlayerRef[]; // jugadores del club (para crear reservas)
  categories: string[]; // categorías de jugadores del club
  requirePrePayment: boolean;
  bookingPrice: number;
}
