import { z } from "zod";

import { ADMIN_MODULES } from "@/config/modules";

export const userTypeSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del tipo."),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  privileges: z
    .array(z.enum(ADMIN_MODULES))
    .min(1, "Seleccioná al menos un privilegio."),
  active: z.boolean().default(true),
});

export type UserTypeValues = z.infer<typeof userTypeSchema>;
