import "dotenv/config";

import { createClub } from "../src/modules/platform/application/create-club";
import { slugifyClubName } from "../src/modules/platform/domain/create-club-schema";

async function main() {
  const name = (process.argv[2] ?? "").trim();
  const slugArg = (process.argv[3] ?? "").trim();
  const ownerEmail = (
    process.argv[4] ?? "mguajardo970@gmail.com"
  ).trim().toLowerCase();
  const ownerName = (process.argv[5] ?? "Marcelo Guajardo").trim();

  if (!name) {
    throw new Error(
      "Uso: tsx scripts/create-club.ts \"Nombre Club\" [slug] [ownerEmail] [ownerName]",
    );
  }

  const slug = slugArg || slugifyClubName(name);
  const result = await createClub({
    name,
    slug,
    ownerEmail,
    ownerName,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  console.log(`Club creado: ${name}`);
  console.log(`Slug: ${result.slug}`);
  console.log(`URL: /${result.slug}/torneos`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
