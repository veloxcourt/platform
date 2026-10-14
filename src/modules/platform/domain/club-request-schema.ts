import { z } from "zod";

export const clubRequestSchema = z.object({
  clubName: z.string().trim().min(2, "Ingresá el nombre del club."),
  contactName: z.string().trim().min(2, "Ingresá tu nombre."),
  email: z
    .email("Ingresá un email válido.")
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(6, "Ingresá un teléfono de contacto."),
  catalogCityId: z.string().trim().min(1, "Elegí la localidad."),
  locality: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ClubRequestValues = z.infer<typeof clubRequestSchema>;
