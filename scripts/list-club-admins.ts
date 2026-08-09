import "dotenv/config";

import { prisma } from "../src/lib/prisma";

async function main() {
  const slug = (process.argv[2] ?? "tiebreak").trim();
  const club = await prisma.club.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!club) throw new Error(`Club no encontrado: ${slug}`);

  const memberships = await prisma.membership.findMany({
    where: {
      clubId: club.id,
      role: { in: ["OWNER", "CLUB_ADMIN"] },
    },
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
          authUserId: true,
        },
      },
      userType: { select: { name: true } },
    },
    orderBy: { role: "asc" },
  });

  console.log(`${club.name} (${club.slug})`);
  for (const membership of memberships) {
    console.log(
      [
        membership.role,
        membership.staffStatus ?? "n/a",
        membership.userType?.name ?? "sin tipo",
        membership.user.fullName,
        membership.user.email,
        membership.user.authUserId ? "tiene login" : "sin login",
      ].join(" | "),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
