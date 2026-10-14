"use server";

import { revalidatePath } from "next/cache";

import { requireClubAccess } from "@/lib/auth/access";
import { requireSuperAdmin } from "@/lib/auth/superadmin";
import {
  listCityOptions,
  listProvinceOptions,
} from "@/modules/cities/application/city-catalog";
import { createCatalogCity } from "@/modules/cities/application/manage-cities";
import {
  createCitySchema,
  type CityOption,
} from "@/modules/cities/domain/city";
import type { ProvinceOption } from "@/modules/cities/application/city-catalog";
import type { CreateCityResult } from "@/modules/cities/application/manage-cities";

export async function listCitiesAction(): Promise<CityOption[]> {
  return listCityOptions();
}

export async function listProvincesAction(): Promise<ProvinceOption[]> {
  return listProvinceOptions();
}

/// Un administrador de club puede sumar una localidad que no está. Queda
/// pendiente de revisión: el superadmin después la confirma o la fusiona.
export async function createClubCityAction(
  clubSlug: string,
  input: unknown,
): Promise<CreateCityResult> {
  await requireClubAccess(clubSlug);
  const parsed = createCitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  return createCatalogCity(parsed.data, { pending: true });
}

export async function createSuperadminCityAction(
  input: unknown,
): Promise<CreateCityResult> {
  await requireSuperAdmin();
  const parsed = createCitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const result = await createCatalogCity(parsed.data, { pending: false });
  if (result.ok) revalidatePath("/superadmin");
  return result;
}
