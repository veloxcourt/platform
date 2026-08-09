import { z } from "zod";

export const createClubSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del club."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usá solo minúsculas, números y guiones.",
    )
    .min(2, "Ingresá un slug.")
    .max(48, "El slug es demasiado largo."),
  ownerEmail: z
    .email("Ingresá un email válido.")
    .transform((value) => value.toLowerCase()),
  ownerName: z.string().trim().min(2, "Ingresá el nombre del dueño."),
  requestId: z.string().optional(),
});

export type CreateClubValues = z.infer<typeof createClubSchema>;

export function slugifyClubName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
