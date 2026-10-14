import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { mergeCatalogCities } from "../src/modules/cities/application/manage-cities";
import { normalizeCityName } from "../src/modules/cities/domain/city";

/// Fusiones decididas a mano sobre el catálogo sembrado de Córdoba.
/// "San Marcos" es San Marcos Sud escrito corto. Los otros tres son typos.
const MERGES: [source: string, target: string][] = [
  ["Bell Bille", "Bell Ville"],
  ["Bell Vile", "Bell Ville"],
  ["Marcos Juareez", "Marcos Juárez"],
  ["San Marcos", "San Marcos Sud"],
];

async function findCity(name: string) {
  const city = await prisma.city.findFirst({
    where: { searchName: normalizeCityName(name) },
    select: { id: true, name: true },
  });
  if (!city) throw new Error(`No está en el catálogo: ${name}`);
  return city;
}

async function main() {
  for (const [sourceName, targetName] of MERGES) {
    const source = await findCity(sourceName);
    const target = await findCity(targetName);
    const result = await mergeCatalogCities(source.id, target.id);
    if (!result.ok) throw new Error(`${sourceName} → ${targetName}: ${result.error}`);
    console.log(`${source.name} → ${target.name}`);
  }

  const remaining = await prisma.city.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      pending: true,
      _count: { select: { users: true, aliases: true } },
    },
  });
  console.log("\nCatálogo:");
  for (const city of remaining) {
    console.log(
      `${city.name.padEnd(24)} ${city._count.users} jugadores, ${city._count.aliases} alias${city.pending ? "  (pendiente)" : ""}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
