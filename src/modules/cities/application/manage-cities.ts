import { ensureRuntimeSchema, prisma } from "@/lib/prisma";

import {
  AR_PROVINCES,
  normalizeCityName,
  toCanonicalCityName,
  type CreateCityValues,
} from "../domain/city";
import { findCityByText, type CityRef } from "./city-catalog";

export type CreateCityResult =
  | { ok: true; created: boolean; city: CityRef }
  | { ok: false; error: string };

export type CityActionResult = { ok: true } | { ok: false; error: string };

/// Da de alta una localidad. Si el nombre ya existe (como nombre o como alias)
/// no crea un duplicado: devuelve la que ya estaba, para que quien la cargó
/// termine eligiendo esa.
export async function createCatalogCity(
  input: CreateCityValues,
  options: { pending: boolean },
): Promise<CreateCityResult> {
  await ensureRuntimeSchema();

  const existing = await findCityByText(input.name);
  if (existing) return { ok: true, created: false, city: existing };

  const province = await prisma.province.findUnique({
    where: { id: input.provinceId },
    select: { id: true, name: true },
  });
  if (!province) return { ok: false, error: "Esa provincia no existe" };

  const searchName = normalizeCityName(input.name);
  const duplicate = await prisma.city.findUnique({
    where: { provinceId_searchName: { provinceId: province.id, searchName } },
    select: { id: true, name: true, active: true },
  });
  if (duplicate) {
    // Estaba dada de baja: volver a activarla es mejor que crear otra igual.
    if (!duplicate.active) {
      await prisma.city.update({
        where: { id: duplicate.id },
        data: { active: true },
      });
    }
    return {
      ok: true,
      created: false,
      city: {
        id: duplicate.id,
        name: duplicate.name,
        provinceName: province.name,
      },
    };
  }

  const city = await prisma.city.create({
    data: {
      provinceId: province.id,
      name: toCanonicalCityName(input.name),
      searchName,
      pending: options.pending,
    },
    select: { id: true, name: true },
  });

  return {
    ok: true,
    created: true,
    city: { id: city.id, name: city.name, provinceName: province.name },
  };
}

export async function renameCatalogCity(
  cityId: string,
  name: string,
): Promise<CityActionResult> {
  await ensureRuntimeSchema();

  const city = await prisma.city.findUnique({
    where: { id: cityId },
    select: { id: true, provinceId: true, name: true },
  });
  if (!city) return { ok: false, error: "Esa localidad no existe" };

  const searchName = normalizeCityName(name);
  const clash = await prisma.city.findUnique({
    where: { provinceId_searchName: { provinceId: city.provinceId, searchName } },
    select: { id: true },
  });
  if (clash && clash.id !== city.id) {
    return { ok: false, error: "Ya hay otra localidad con ese nombre" };
  }

  await prisma.city.update({
    where: { id: city.id },
    data: { name: toCanonicalCityName(name), searchName, pending: false },
  });
  return { ok: true };
}

/// Suma una forma alternativa de escribirla ("SMS"). El alias es único en todo
/// el catálogo: si ya apunta a otra ciudad, se rechaza en vez de mover nada.
export async function addCityAlias(
  cityId: string,
  label: string,
): Promise<CityActionResult> {
  await ensureRuntimeSchema();

  const searchName = normalizeCityName(label);
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    select: { id: true, searchName: true },
  });
  if (!city) return { ok: false, error: "Esa localidad no existe" };
  if (city.searchName === searchName) {
    return { ok: false, error: "Ese ya es el nombre de la localidad" };
  }

  const taken = await prisma.cityAlias.findUnique({
    where: { searchName },
    select: { cityId: true, city: { select: { name: true } } },
  });
  if (taken) {
    if (taken.cityId === city.id) return { ok: true };
    return {
      ok: false,
      error: `Ese alias ya apunta a ${taken.city.name}`,
    };
  }

  await prisma.cityAlias.create({
    data: { cityId: city.id, label: label.trim(), searchName },
  });
  return { ok: true };
}

export async function removeCityAlias(aliasId: string): Promise<CityActionResult> {
  await ensureRuntimeSchema();
  await prisma.cityAlias.deleteMany({ where: { id: aliasId } });
  return { ok: true };
}

/// Fusiona dos localidades que son la misma: los jugadores, clubes y
/// solicitudes de `source` pasan a `target`, el nombre viejo queda como alias
/// y `source` desaparece del catálogo.
///
/// A propósito no toca la copia de texto (`users.city`): así la fusión es
/// reversible y no cambia lo que la gente ve hasta que se decida sincronizar.
export async function mergeCatalogCities(
  sourceId: string,
  targetId: string,
): Promise<CityActionResult> {
  await ensureRuntimeSchema();

  if (sourceId === targetId) return { ok: false, error: "Son la misma localidad" };

  const [source, target] = await Promise.all([
    prisma.city.findUnique({
      where: { id: sourceId },
      select: { id: true, name: true, searchName: true },
    }),
    prisma.city.findUnique({
      where: { id: targetId },
      select: { id: true, searchName: true },
    }),
  ]);
  if (!source || !target) return { ok: false, error: "Esa localidad no existe" };

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { catalogCityId: source.id },
      data: { catalogCityId: target.id },
    });
    await tx.club.updateMany({
      where: { catalogCityId: source.id },
      data: { catalogCityId: target.id },
    });
    await tx.clubRequest.updateMany({
      where: { catalogCityId: source.id },
      data: { catalogCityId: target.id },
    });

    // Los alias de la que se va pasan a la que queda; ya eran únicos.
    await tx.cityAlias.updateMany({
      where: { cityId: source.id },
      data: { cityId: target.id },
    });

    // El nombre viejo queda como alias, salvo que ya esté tomado.
    if (source.searchName !== target.searchName) {
      const taken = await tx.cityAlias.findUnique({
        where: { searchName: source.searchName },
        select: { id: true },
      });
      if (!taken) {
        await tx.cityAlias.create({
          data: {
            cityId: target.id,
            label: source.name,
            searchName: source.searchName,
          },
        });
      }
    }

    // Borrar recién al final: los alias ya se movieron, así que el cascade de
    // `city_aliases` no se lleva nada puesto.
    await tx.city.delete({ where: { id: source.id } });
  });

  return { ok: true };
}

export async function setCityActive(
  cityId: string,
  active: boolean,
): Promise<CityActionResult> {
  await ensureRuntimeSchema();
  await prisma.city.updateMany({ where: { id: cityId }, data: { active } });
  return { ok: true };
}

/// Marca como revisada una localidad que había creado un club.
export async function markCityReviewed(cityId: string): Promise<CityActionResult> {
  await ensureRuntimeSchema();
  await prisma.city.updateMany({ where: { id: cityId }, data: { pending: false } });
  return { ok: true };
}

/// Pone al día la copia de texto de jugadores y clubes con el nombre canónico
/// del catálogo. Es un paso aparte y explícito porque cambia lo que la gente
/// ve: recién conviene correrlo cuando el catálogo ya está ordenado.
export async function syncCityNameSnapshots(): Promise<{
  players: number;
  clubs: number;
}> {
  await ensureRuntimeSchema();

  const players = await prisma.$executeRaw`
    UPDATE "users" AS u
    SET "city" = c."name"
    FROM "cities" AS c
    WHERE u."catalogCityId" = c."id"
      AND (u."city" IS DISTINCT FROM c."name")
  `;
  const clubs = await prisma.$executeRaw`
    UPDATE "clubs" AS cl
    SET "locality" = c."name"
    FROM "cities" AS c
    WHERE cl."catalogCityId" = c."id"
      AND (cl."locality" IS DISTINCT FROM c."name")
  `;

  return { players, clubs };
}

export async function createProvince(
  name: string,
  country = "AR",
): Promise<CityActionResult> {
  await ensureRuntimeSchema();
  const searchName = normalizeCityName(name);
  const existing = await prisma.province.findUnique({
    where: { country_searchName: { country, searchName } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "Esa provincia ya está" };

  await prisma.province.create({
    data: { name: name.trim(), searchName, country },
  });
  return { ok: true };
}

/// Siembra las provincias argentinas. Idempotente: se puede repetir.
export async function seedArProvinces(): Promise<number> {
  await ensureRuntimeSchema();

  const before = await prisma.province.count({ where: { country: "AR" } });
  for (let index = 0; index < AR_PROVINCES.length; index += 1) {
    const name = AR_PROVINCES[index]!;
    const searchName = normalizeCityName(name);
    await prisma.province.upsert({
      where: { country_searchName: { country: "AR", searchName } },
      update: { sortOrder: index },
      create: { name, searchName, country: "AR", sortOrder: index },
      select: { id: true },
    });
  }
  const after = await prisma.province.count({ where: { country: "AR" } });
  return after - before;
}
