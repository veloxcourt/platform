"use client";

import { useState, type ReactNode } from "react";

import {
  parseFixtureEditMode,
  type FixtureEditMode,
} from "@/modules/tournaments/domain/fixture-edit-mode";
import { FixtureEditModeProvider } from "./fixture-edit-mode-context";
import { FixtureEditModeSelect } from "./fixture-edit-mode-select";
import { useTournamentReadOnly } from "./tournament-mode-context";

export function FixtureEditModePage({
  clubSlug,
  tournamentId,
  initialMode,
  children,
}: {
  clubSlug: string;
  tournamentId: string;
  initialMode?: FixtureEditMode | string | null;
  children: ReactNode;
}) {
  const readOnly = useTournamentReadOnly();
  const [mode, setMode] = useState(() => parseFixtureEditMode(initialMode));

  return (
    <FixtureEditModeProvider
      mode={mode}
      readOnly={readOnly}
      setMode={setMode}
    >
      {!readOnly ? (
        <div className="mb-3 flex justify-end">
          <FixtureEditModeSelect
            clubSlug={clubSlug}
            tournamentId={tournamentId}
          />
        </div>
      ) : null}
      {children}
    </FixtureEditModeProvider>
  );
}
