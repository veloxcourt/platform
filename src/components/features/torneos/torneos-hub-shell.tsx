import { Trophy } from "lucide-react";

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
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Trophy className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Torneos</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <TorneosSubnav clubSlug={clubSlug} />
      {children}
    </div>
  );
}
