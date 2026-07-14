import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export const togglePairSlotSchema = z.object({
  playDate: z.string().regex(DATE_REGEX, "Fecha inválida"),
  courtIndex: z.number().int().min(0).max(31),
  slotIndex: z.number().int().min(0).max(128),
  startTime: z.string().regex(TIME_REGEX, "Hora inválida"),
  endTime: z.string().regex(TIME_REGEX, "Hora inválida"),
});

export type TogglePairSlotValues = z.infer<typeof togglePairSlotSchema>;

export const pairPreferenceSlotSchema = z.object({
  playDate: z.string().regex(DATE_REGEX, "Fecha inválida"),
  slotIndex: z.number().int().min(0).max(128),
  startTime: z.string().regex(TIME_REGEX, "Hora inválida"),
  endTime: z.string().regex(TIME_REGEX, "Hora inválida"),
});

export const replacePairSlotPreferencesSchema = z.object({
  slots: z.array(pairPreferenceSlotSchema),
});

export type PairPreferenceSlotValues = z.infer<typeof pairPreferenceSlotSchema>;
export type ReplacePairSlotPreferencesValues = z.infer<
  typeof replacePairSlotPreferencesSchema
>;
