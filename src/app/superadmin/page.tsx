import { CitiesCatalogPanel } from "@/components/features/platform/cities-catalog-panel";
import { SuperadminPanel } from "@/components/features/platform/superadmin-panel";
import { enforceSuperAdminPage } from "@/lib/auth/superadmin";
import { prisma } from "@/lib/prisma";

export default async function SuperadminPage() {
  await enforceSuperAdminPage();

  const [requests, clubs, cities, provinces] = await Promise.all([
    prisma.clubRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.club.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.city.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        pending: true,
        province: { select: { name: true } },
        aliases: { select: { label: true }, orderBy: { label: "asc" } },
        _count: { select: { users: true } },
      },
    }),
    prisma.province.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-muted/20 p-6">
      <SuperadminPanel
        clubs={clubs}
        requests={requests.map((request) => ({
          id: request.id,
          clubName: request.clubName,
          contactName: request.contactName,
          email: request.email,
          phone: request.phone,
          locality: request.locality,
          message: request.message,
          status: request.status,
          createdAt: request.createdAt.toISOString(),
        }))}
      />
      <div className="mx-auto mt-6 max-w-6xl">
        <CitiesCatalogPanel
          provinces={provinces}
          cities={cities.map((city) => ({
            id: city.id,
            name: city.name,
            provinceName: city.province.name,
            pending: city.pending,
            playerCount: city._count.users,
            aliases: city.aliases.map((alias) => alias.label),
          }))}
        />
      </div>
    </main>
  );
}
