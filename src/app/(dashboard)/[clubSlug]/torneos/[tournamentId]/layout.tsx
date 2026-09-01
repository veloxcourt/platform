import { Suspense } from "react";

import { TournamentModeProvider } from "@/components/features/torneos/tournament-mode-context";

export default function TournamentDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <TournamentModeProvider>{children}</TournamentModeProvider>
    </Suspense>
  );
}
