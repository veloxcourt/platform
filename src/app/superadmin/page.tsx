import { SuperadminPanel } from "@/components/features/platform/superadmin-panel";
import { enforceSuperAdminPage } from "@/lib/auth/superadmin";
import { prisma } from "@/lib/prisma";

export default async function SuperadminPage() {
  await enforceSuperAdminPage();

  const [requests, clubs] = await Promise.all([
    prisma.clubRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.club.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
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
    </main>
  );
}
