import { z } from "zod";

export const clubProfileSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del complejo").max(80),
  locality: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(160).optional().or(z.literal("")),
});

export type ClubProfileValues = z.infer<typeof clubProfileSchema>;

export type ClubProfile = {
  name: string;
  logoUrl: string | null;
  locality: string | null;
  address: string | null;
};
