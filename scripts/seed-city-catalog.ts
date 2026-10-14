import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import {
  normalizeCityName,
  pickRichestVariant,
  toCanonicalCityName,
} from "../src/modules/cities/domain/city";
import { seedArProvinces } from "../src/modules/cities/application/manage-cities";

/// Siembra el catálogo de localidades a partir de las que ya están cargadas a
/// mano en los jugadores.
///
/// Agrupa solo lo que es la misma escritura una vez normalizada ("SAN MARCOS
/// SUD", "San marcos sud", "San Marcos Sud."). A propósito NO junta "San
/// Marcos" con "San Marcos Sud" ni con "SMS": eso es una decisión de una
/// persona y se hace después, con la fusión del panel de superadmin.
///
/// Por defecto solo informa. Con `--write --province "Córdoba"` escribe, y
/// únicamente toca la columna nueva `catalogCityId`: el texto que hoy ve la
/// gente en `users.city` queda intacto, así que es reversible.
///
///   npm run db:seed-cities
///   npm run db:seed-cities -- --write --province "Córdoba"

type Group = {
  searchName: string;
  /// Cada forma de escribirlo y cuántos jugadores la tienen.
  variants: Map<string, number>;
  /// Los jugadores se vinculan por id, no por texto: hay valores con espacios
  /// de más que no coinciden con la variante recortada.
  playerIds: string[];
  total: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const provinceIndex = args.indexOf("--province");
  const province =
    provinceIndex >= 0 ? (args[provinceIndex + 1] ?? "").trim() : "";
  return { write, province };
}

function buildGroups(players: { id: string; city: string | null }[]): Group[] {
  const groups = new Map<string, Group>();
  for (const player of players) {
    const raw = player.city?.trim();
    if (!raw) continue;
    const searchName = normalizeCityName(raw);
    if (!searchName) continue;

    let group = groups.get(searchName);
    if (!group) {
      group = { searchName, variants: new Map(), playerIds: [], total: 0 };
      groups.set(searchName, group);
    }
    group.variants.set(raw, (group.variants.get(raw) ?? 0) + 1);
    group.playerIds.push(player.id);
    group.total += 1;
  }
  return [...groups.values()].sort(
    (a, b) => b.total - a.total || a.searchName.localeCompare(b.searchName, "es"),
  );
}

function canonicalOf(group: Group): string {
  return toCanonicalCityName(pickRichestVariant(group.variants));
}

async function main() {
  const { write, province: provinceName } = parseArgs();

  const seeded = await seedArProvinces();
  console.log(`Provincias argentinas: ${seeded} nuevas.`);

  const players = await prisma.user.findMany({
    where: { city: { not: null } },
    select: { id: true, city: true },
  });
  const groups = buildGroups(players);

  const [linked, unlinked] = await Promise.all([
    prisma.user.count({ where: { catalogCityId: { not: null } } }),
    prisma.user.count({ where: { city: { not: null }, catalogCityId: null } }),
  ]);

  console.log(
    `\nJugadores con localidad cargada: ${players.length}. Localidades distintas tras normalizar: ${groups.length}.`,
  );
  console.log(
    `Vinculados al catálogo: ${linked}. Con texto pero sin vincular: ${unlinked}.\n`,
  );
  for (const group of groups) {
    const variants = [...group.variants.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([variant, count]) => `"${variant}" x${count}`)
      .join(", ");
    console.log(`${canonicalOf(group).padEnd(28)} ${group.total} jugador(es)  ←  ${variants}`);
  }

  if (!write) {
    console.log(
      "\nSimulación: no se escribió nada. Para aplicar:\n  npm run db:seed-cities -- --write --province \"Córdoba\"",
    );
    return;
  }

  if (!provinceName) {
    throw new Error(
      'Con --write hay que indicar la provincia. Ej: --province "Córdoba"',
    );
  }
  const province = await prisma.province.findUnique({
    where: {
      country_searchName: {
        country: "AR",
        searchName: normalizeCityName(provinceName),
      },
    },
    select: { id: true, name: true },
  });
  if (!province) throw new Error(`No existe la provincia "${provinceName}"`);

  const citiesBefore = await prisma.city.count();
  let linkedPlayers = 0;

  for (const group of groups) {
    const name = canonicalOf(group);
    // `pending` deja marcado que lo trajo la migración y todavía nadie lo
    // revisó: son justo los candidatos a fusionar.
    const city = await prisma.city.upsert({
      where: {
        provinceId_searchName: {
          provinceId: province.id,
          searchName: group.searchName,
        },
      },
      update: {},
      create: {
        provinceId: province.id,
        name,
        searchName: group.searchName,
        pending: true,
      },
      select: { id: true },
    });

    // Solo la columna nueva. `users.city` no se toca.
    const result = await prisma.user.updateMany({
      where: { id: { in: group.playerIds }, catalogCityId: null },
      data: { catalogCityId: city.id },
    });
    linkedPlayers += result.count;
  }

  const createdCities = (await prisma.city.count()) - citiesBefore;
  console.log(
    `\nListo en ${province.name}: ${createdCities} localidades nuevas, ${linkedPlayers} jugadores vinculados.`,
  );
  console.log(
    "El texto de `users.city` quedó igual. Para revertir: poner catalogCityId en null.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
