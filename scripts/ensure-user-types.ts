import "dotenv/config";

import { ensureClubUserTypes } from "../src/lib/auth/user-types";
import { prisma } from "../src/lib/prisma";

async function main() {
  const slug = process.argv[2] ?? "club-demo";
  const club = await prisma.club.findUnique({ where: { slug } });
  if (!club) throw new Error(`Club no encontrado: ${slug}`);
  const result = await ensureClubUserTypes(club.id);
  console.log(
    `Tipos listos en ${slug}: ${result.ownerType.name}, ${result.adminType.name}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
