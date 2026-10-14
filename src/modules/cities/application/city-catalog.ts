import { ensureRuntimeSchema, prisma } from "@/lib/prisma";

import { normalizeCityName, type CityOption } from "../domain/city";

export type CityRef = { id: string; name: string; provinceName: string };
export type ProvinceOption = { id: string; name: string };

/// Todas las localidades elegibles, con sus alias, para que el buscador filtre
/// en el cliente sin ir al servidor en cada tecla. El catálogo es global y
/// chico (no es un padrón completo), así que entra entero sin problema.
export async function listCityOptions(): Promise<CityOption[]> {
  await ensureRuntimeSchema();
  const cities = await prisma.city.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      searchName: true,
      province: { select: { name: true } },
      aliases: { select: { searchName: true } },
    },
  });

  return cities.map((city) => ({
    id: city.id,
    name: city.name,
    provinceName: city.province.name,
    terms: [city.searchName, ...city.aliases.map((alias) => alias.searchName)],
  }));
}

export async function listProvinceOptions(): Promise<ProvinceOption[]> {
  await ensureRuntimeSchema();
  const provinces = await prisma.province.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return provinces;
}

/// Confirma que la localidad elegida exista y siga vigente, y devuelve el
/// nombre canónico para guardar la copia de texto. Nunca confiar en el nombre
/// que llega del formulario: solo viaja el id.
/// Traduce el id que mandó el formulario al par que se guarda: el id y el
/// nombre canónico. Un id vacío limpia la localidad. Un id inventado se
/// rechaza, así nadie escribe el nombre a mano.
export async function catalogCityAssignment(
  cityId: string | null | undefined,
): Promise<
  | { ok: true; catalogCityId: string | null; name: string | null }
  | { ok: false; error: string }
> {
  const id = cityId?.trim();
  if (!id) return { ok: true, catalogCityId: null, name: null };
  const city = await resolveCatalogCity(id);
  if (!city) return { ok: false, error: "Elegí una localidad del listado" };
  return { ok: true, catalogCityId: city.id, name: city.name };
}

export async function resolveCatalogCity(
  cityId: string | null | undefined,
): Promise<CityRef | null> {
  const id = cityId?.trim();
  if (!id) return null;

  await ensureRuntimeSchema();
  const city = await prisma.city.findFirst({
    where: { id, active: true },
    select: { id: true, name: true, province: { select: { name: true } } },
  });
  if (!city) return null;
  return { id: city.id, name: city.name, provinceName: city.province.name };
}

/// Busca la localidad que corresponde a un texto suelto, por nombre o por
/// alias. La usa la migración de los datos viejos y el alta de localidades,
/// para no crear un duplicado de algo que ya está escrito de otra forma.
export async function findCityByText(text: string): Promise<CityRef | null> {
  const searchName = normalizeCityName(text);
  if (!searchName) return null;

  await ensureRuntimeSchema();
  const byAlias = await prisma.cityAlias.findUnique({
    where: { searchName },
    select: {
      city: {
        select: { id: true, name: true, province: { select: { name: true } } },
      },
    },
  });
  if (byAlias) {
    return {
      id: byAlias.city.id,
      name: byAlias.city.name,
      provinceName: byAlias.city.province.name,
    };
  }

  const matches = await prisma.city.findMany({
    where: { searchName },
    select: { id: true, name: true, province: { select: { name: true } } },
    take: 2,
  });
  // Si el mismo nombre existe en dos provincias, no hay forma de saber cuál
  // quiso decir: que lo resuelva una persona.
  if (matches.length !== 1) return null;
  const city = matches[0]!;
  return { id: city.id, name: city.name, provinceName: city.province.name };
}
