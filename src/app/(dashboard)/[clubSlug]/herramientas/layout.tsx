import { HerramientasSubnav } from "@/components/features/herramientas/herramientas-subnav";

export default async function HerramientasLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Herramientas</h1>
        <p className="text-sm text-muted-foreground">
          Utilidades de apoyo para la operación del club
        </p>
      </div>

      <HerramientasSubnav clubSlug={clubSlug} />

      {children}
    </div>
  );
}
