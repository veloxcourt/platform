"use client";

import { useState, type ReactNode } from "react";

import {
  parseFixtureEditModes,
  type FixtureEditModes,
} from "@/modules/tournaments/domain/fixture-edit-mode";
import { FixtureEditModeProvider } from "./fixture-edit-mode-context";
import { useTournamentReadOnly } from "./tournament-mode-context";

export function FixtureEditModePage({
  categoryId,
  initialModes,
  children,
}: {
  clubSlug: string;
  tournamentId: string;
  categoryId: string;
  categoryName?: string;
  initialModes?: FixtureEditModes | string | null;
  children: ReactNode;
}) {
  const readOnly = useTournamentReadOnly();
  const [modes, setModes] = useState(() =>
    parseFixtureEditModes(initialModes, [categoryId]),
  );

  return (
    <FixtureEditModeProvider
      modes={modes}
      readOnly={readOnly}
      setModes={setModes}
    >
      {children}
    </FixtureEditModeProvider>
  );
}
