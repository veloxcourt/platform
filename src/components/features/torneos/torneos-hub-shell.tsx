import { TorneosSubnav } from "./torneos-subnav";

export function TorneosHubShell({
  clubSlug,
  subtitle,
  children,
}: {
  clubSlug: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Torneos</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <TorneosSubnav clubSlug={clubSlug} />
      {children}
    </div>
  );
}
