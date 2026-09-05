import { z } from "zod";

export const IMPROVEMENT_KINDS = ["IMPROVE", "ADD"] as const;
export const IMPROVEMENT_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
] as const;

export const IMPROVEMENT_KIND_LABELS: Record<
  (typeof IMPROVEMENT_KINDS)[number],
  string
> = {
  IMPROVE: "Mejorar",
  ADD: "Agregar",
};

export const IMPROVEMENT_STATUS_LABELS: Record<
  (typeof IMPROVEMENT_STATUSES)[number],
  string
> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  DONE: "Hecho",
};

export const improvementSchema = z.object({
  title: z.string().trim().min(2, "Ingresá qué querés mejorar o agregar."),
  detail: z.string().trim().max(500).optional().or(z.literal("")),
  kind: z.enum(IMPROVEMENT_KINDS),
  status: z.enum(IMPROVEMENT_STATUSES),
});

export type ImprovementValues = z.infer<typeof improvementSchema>;

export type ImprovementItem = {
  id: string;
  title: string;
  detail: string | null;
  kind: ImprovementValues["kind"];
  status: ImprovementValues["status"];
  createdAt: string;
};
