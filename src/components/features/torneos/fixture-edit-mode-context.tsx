"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  parseFixtureEditMode,
  type FixtureEditMode,
} from "@/modules/tournaments/domain/fixture-edit-mode";

type FixtureEditModeContextValue = {
  mode: FixtureEditMode;
  isManual: boolean;
  scheduleLocked: boolean;
  setMode: (mode: FixtureEditMode) => void;
};

const FixtureEditModeContext = createContext<FixtureEditModeContextValue>({
  mode: "AUTO",
  isManual: false,
  scheduleLocked: true,
  setMode: () => {},
});

export function FixtureEditModeProvider({
  mode,
  readOnly,
  setMode,
  children,
}: {
  mode: FixtureEditMode | string | null | undefined;
  readOnly: boolean;
  setMode: (mode: FixtureEditMode) => void;
  children: ReactNode;
}) {
  const parsed = parseFixtureEditMode(mode);
  const isManual = parsed === "MANUAL";
  return (
    <FixtureEditModeContext.Provider
      value={{
        mode: parsed,
        isManual,
        scheduleLocked: readOnly || !isManual,
        setMode,
      }}
    >
      {children}
    </FixtureEditModeContext.Provider>
  );
}

export function useFixtureEditMode() {
  return useContext(FixtureEditModeContext);
}
