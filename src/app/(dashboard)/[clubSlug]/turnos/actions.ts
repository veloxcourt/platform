"use server";

import { revalidatePath } from "next/cache";

import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import {
  createSupabaseAdminClient,
  PLAYER_PHOTOS_BUCKET,
} from "@/lib/supabase/admin";
import { createBooking } from "@/modules/bookings/application/create-booking";
import {
  cancelBooking,
  cancelFixedBooking,
  confirmBooking,
  setBookingPayment,
  setBookingStatus,
  updateBooking,
} from "@/modules/bookings/application/booking-commands";
import type { UpdateBookingData } from "@/modules/bookings/domain/types";
import {
  createBookingSchema,
  type CreateBookingValues,
} from "@/modules/bookings/domain/create-booking-schema";
import {
  newPlayerSchema,
  type NewPlayerValues,
} from "@/modules/bookings/domain/new-player-schema";
import {
  createPlayer,
  getPlayerProfile,
  updatePlayer,
  deletePlayer,
  type CreatePlayerResult,
  type PlayerProfileResult,
} from "@/modules/bookings/application/create-player";
import type { CommandResult } from "@/modules/bookings/application/create-booking";
import type { PaymentStatus } from "@/modules/bookings/domain/types";
import {
  getPlayerAccount,
  addMovement,
  type AccountResult,
} from "@/modules/accounts/application/account";
import {
  addMovementSchema,
  type AddMovementValues,
} from "@/modules/accounts/domain/movement-schema";

export async function createBookingAction(
  clubSlug: string,
  values: CreateBookingValues,
): Promise<CommandResult> {
  const parsed = createBookingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Datos de reserva inválidos" };

  const repo = getBookingRepository();
  const result = await createBooking(repo, clubSlug, parsed.data);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function createPlayerAction(
  clubSlug: string,
  values: NewPlayerValues,
): Promise<CreatePlayerResult> {
  const parsed = newPlayerSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Datos del jugador inválidos" };

  const repo = getBookingRepository();
  const result = await createPlayer(repo, clubSlug, parsed.data);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function getPlayerProfileAction(
  clubSlug: string,
  userId: string,
): Promise<PlayerProfileResult> {
  const repo = getBookingRepository();
  return getPlayerProfile(repo, clubSlug, userId);
}

export async function uploadPlayerPhotoAction(
  clubSlug: string,
  userId: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Elegí una imagen" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "El archivo debe ser una imagen" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "La imagen supera 5MB" };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${club.id}/${userId}-${Date.now()}.${ext}`;
  const admin = createSupabaseAdminClient();
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(PLAYER_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) return { ok: false, error: error.message };

  const { data } = admin.storage
    .from(PLAYER_PHOTOS_BUCKET)
    .getPublicUrl(path);

  await repo.setPlayerPhoto(club.id, userId, data.publicUrl);
  revalidatePath(`/${clubSlug}/jugadores`);
  return { ok: true, url: data.publicUrl };
}

export async function removePlayerPhotoAction(
  clubSlug: string,
  userId: string,
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  await repo.setPlayerPhoto(club.id, userId, null);
  revalidatePath(`/${clubSlug}/jugadores`);
  revalidatePath(`/${clubSlug}/turnos`);
  return { ok: true };
}

export async function updatePlayerAction(
  clubSlug: string,
  userId: string,
  values: NewPlayerValues,
): Promise<CommandResult> {
  const parsed = newPlayerSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Datos del jugador inválidos" };
  const repo = getBookingRepository();
  const result = await updatePlayer(repo, clubSlug, userId, parsed.data);
  if (result.ok) {
    revalidatePath(`/${clubSlug}/jugadores`);
    revalidatePath(`/${clubSlug}/turnos`);
  }
  return result;
}

export async function deletePlayerAction(
  clubSlug: string,
  userId: string,
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const result = await deletePlayer(repo, clubSlug, userId);
  if (result.ok) {
    revalidatePath(`/${clubSlug}/jugadores`);
    revalidatePath(`/${clubSlug}/turnos`);
    revalidatePath(`/${clubSlug}/torneos`);
  }
  return result;
}

export async function confirmBookingAction(
  clubSlug: string,
  bookingId: string,
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const result = await confirmBooking(repo, clubSlug, bookingId);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function cancelBookingAction(
  clubSlug: string,
  bookingId: string,
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const result = await cancelBooking(repo, clubSlug, bookingId);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function cancelFixedBookingAction(
  clubSlug: string,
  fixedBookingId: string,
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const result = await cancelFixedBooking(repo, clubSlug, fixedBookingId);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function updateBookingAction(
  clubSlug: string,
  bookingId: string,
  data: UpdateBookingData,
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const result = await updateBooking(repo, clubSlug, bookingId, data);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function getPlayerAccountAction(
  clubSlug: string,
  userId: string,
): Promise<AccountResult> {
  const repo = getBookingRepository();
  return getPlayerAccount(repo, clubSlug, userId);
}

export async function addMovementAction(
  clubSlug: string,
  userId: string,
  values: AddMovementValues,
): Promise<CommandResult> {
  const parsed = addMovementSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos del movimiento inválidos" };
  }
  const repo = getBookingRepository();
  const result = await addMovement(repo, clubSlug, userId, parsed.data);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function setBookingStatusAction(
  clubSlug: string,
  bookingId: string,
  status: "PRE_RESERVA" | "RESERVADO",
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const result = await setBookingStatus(repo, clubSlug, bookingId, status);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}

export async function setBookingPaymentAction(
  clubSlug: string,
  bookingId: string,
  status: PaymentStatus,
): Promise<CommandResult> {
  const repo = getBookingRepository();
  const result = await setBookingPayment(repo, clubSlug, bookingId, status);
  if (result.ok) revalidatePath(`/${clubSlug}/turnos`);
  return result;
}
