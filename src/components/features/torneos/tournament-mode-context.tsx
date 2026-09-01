"use client";

import { createContext, useContext } from "react";
import { useSearchParams } from "next/navigation";

import {
  parseTournamentMode,
  withTournamentMode,
  type TournamentMode,
} from "@/lib/tournament-mode";

const TournamentModeContext = createContext<TournamentMode>("editar");

export function TournamentModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const mode = parseTournamentMode(searchParams.get("modo"));

  return (
    <TournamentModeContext.Provider value={mode}>
      {children}
    </TournamentModeContext.Provider>
  );
}

export function useTournamentMode() {
  return useContext(TournamentModeContext);
}

export function useTournamentReadOnly() {
  return useTournamentMode() === "ver";
}

export function useTournamentHref() {
  const mode = useTournamentMode();
  return (href: string) => withTournamentMode(href, mode);
}
