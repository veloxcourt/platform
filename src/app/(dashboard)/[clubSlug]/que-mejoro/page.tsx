import { ImprovementsTable } from "@/components/features/improvements/improvements-table";
import { getClubAccess } from "@/lib/auth/access";
import { ensureRuntimeSchema, prisma } from "@/lib/prisma";

export const metadata = {
  title: "Qué mejoro? · VeloxCourt",
};

export default async function QueMejoroPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) return null;
  await ensureRuntimeSchema();

  let items: Awaited<ReturnType<typeof prisma.clubImprovement.findMany>> = [];
  try {
    items = await prisma.clubImprovement.findMany({
      where: { clubId: access.club.id },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    console.error("[que-mejoro] club_improvements unavailable", error);
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold">Qué mejoro?</h1>
        <p className="text-sm text-muted-foreground">
          Anotá ideas para mejorar o agregar. {items.length} ítem
          {items.length === 1 ? "" : "s"}.
        </p>
      </div>

      <ImprovementsTable
        clubSlug={clubSlug}
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          detail: item.detail,
          kind: item.kind,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
