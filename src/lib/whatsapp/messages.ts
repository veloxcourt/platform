export function buildTestMessage(clubName: string, playerName: string): string {
  return [
    `Hola ${playerName}!`,
    "",
    `Prueba de notificación de *${clubName}* vía VeloxCourt.`,
    "",
    "Si recibís este mensaje, el sistema de alarmas está funcionando.",
  ].join("\n");
}

export function buildBookingReminderMessage(input: {
  clubName: string;
  playerName: string;
  courtName: string;
  dateLabel: string;
  time: string;
}): string {
  return [
    `Hola ${input.playerName}!`,
    "",
    `Recordatorio de turno en *${input.clubName}*:`,
    `📅 ${input.dateLabel} · ${input.time} hs`,
    `🎾 ${input.courtName}`,
    "",
    "Cualquier cambio, contactá al club.",
  ].join("\n");
}
