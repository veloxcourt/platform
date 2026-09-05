import { z } from "zod";

import { GENDERS } from "@/modules/bookings/domain/new-player-schema";
import { DEFAULT_PHONE_DIAL, normalizeToE164 } from "@/lib/phone";

const playerSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre").max(60),
  lastName: z.string().trim().min(1, "Ingresá el apellido").max(60),
  phone: z.string().trim().min(6, "Ingresá el teléfono"),
  gender: z.enum(GENDERS),
});

export const publicInscriptionSchema = z
  .object({
    publicSlug: z.string().trim().min(1),
    categoryId: z.string().min(1, "Elegí la categoría"),
    player1: playerSchema,
    player2: playerSchema,
  })
  .superRefine((data, ctx) => {
    const phone1 = normalizeToE164(data.player1.phone, DEFAULT_PHONE_DIAL);
    const phone2 = normalizeToE164(data.player2.phone, DEFAULT_PHONE_DIAL);
    if (!phone1) {
      ctx.addIssue({
        code: "custom",
        message: "Teléfono inválido. Ej: 11 2345 6789",
        path: ["player1", "phone"],
      });
    }
    if (!phone2) {
      ctx.addIssue({
        code: "custom",
        message: "Teléfono inválido. Ej: 11 2345 6789",
        path: ["player2", "phone"],
      });
    }
    if (phone1 && phone2 && phone1 === phone2) {
      ctx.addIssue({
        code: "custom",
        message: "Los dos jugadores deben tener teléfonos distintos",
        path: ["player2", "phone"],
      });
    }
  });

export type PublicInscriptionValues = z.infer<typeof publicInscriptionSchema>;
