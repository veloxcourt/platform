import { z } from "zod";

export const adminSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá el nombre."),
  email: z
    .email("Ingresá un email válido.")
    .transform((value) => value.toLowerCase()),
  userTypeId: z.string().min(1, "Elegí un tipo de usuario."),
});

export const adminTypeSchema = z.object({
  membershipId: z.string().min(1),
  userTypeId: z.string().min(1, "Elegí un tipo de usuario."),
});
