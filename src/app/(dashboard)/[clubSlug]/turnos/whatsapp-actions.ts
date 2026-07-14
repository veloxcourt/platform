"use server";

import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { buildTestMessage } from "@/lib/whatsapp/messages";
import { isWhatsAppApiConfigured } from "@/lib/whatsapp/config";
import {
  sendWhatsAppMessage,
  type WhatsAppSendResult,
} from "@/modules/notifications/application/send-whatsapp-message";

export type WhatsAppStatusResult = {
  apiConfigured: boolean;
};

export async function getWhatsAppStatusAction(): Promise<WhatsAppStatusResult> {
  return { apiConfigured: isWhatsAppApiConfigured() };
}

export async function sendWhatsAppTestAction(
  clubSlug: string,
  playerId: string,
  options?: { forceApi?: boolean },
): Promise<WhatsAppSendResult> {
  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const players = await repo.listPlayers(club.id);
  const player = players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: "Jugador no encontrado" };
  if (!player.phone) {
    return { ok: false, error: "El jugador no tiene teléfono cargado" };
  }

  const body = buildTestMessage(club.name, player.fullName);
  return sendWhatsAppMessage(player.phone, body, options);
}
