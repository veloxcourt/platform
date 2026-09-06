"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

import {
  DEFAULT_FIXTURE_EDIT_MODES,
  fixtureEditModeFor,
  parseFixtureEditModes,
  setCategoryPhaseMode,
  type FixtureEditMode,
  type FixtureEditModes,
  type FixtureEditPhase,
} from "@/modules/tournaments/domain/fixture-edit-mode";

type FlushFn = () => Promise<unknown>;

type FixtureEditModeContextValue = {
  modes: FixtureEditModes;
  readOnly: boolean;
  setModes: (modes: FixtureEditModes) => void;
  setCategoryPhaseMode: (
    categoryId: string,
    phase: FixtureEditPhase,
    mode: FixtureEditMode,
  ) => void;
  registerPersistFlush: (fn: FlushFn) => () => void;
  flushPendingPersists: () => Promise<void>;
};

const FixtureEditModeContext = createContext<FixtureEditModeContextValue>({
  modes: DEFAULT_FIXTURE_EDIT_MODES,
  readOnly: false,
  setModes: () => {},
  setCategoryPhaseMode: () => {},
  registerPersistFlush: () => () => {},
  flushPendingPersists: async () => {},
});

export function FixtureEditModeProvider({
  modes,
  readOnly,
  setModes,
  children,
}: {
  modes: FixtureEditModes;
  readOnly: boolean;
  setModes: (modes: FixtureEditModes) => void;
  children: ReactNode;
}) {
  const parsed = parseFixtureEditModes(modes);
  const flushesRef = useRef(new Set<FlushFn>());

  const registerPersistFlush = useCallback((fn: FlushFn) => {
    flushesRef.current.add(fn);
    return () => {
      flushesRef.current.delete(fn);
    };
  }, []);

  const flushPendingPersists = useCallback(async () => {
    await Promise.all([...flushesRef.current].map((fn) => fn()));
  }, []);

  const setCategoryPhase = useCallback(
    (categoryId: string, phase: FixtureEditPhase, mode: FixtureEditMode) => {
      setModes(setCategoryPhaseMode(parsed, categoryId, phase, mode));
    },
    [parsed, setModes],
  );

  return (
    <FixtureEditModeContext.Provider
      value={{
        modes: parsed,
        readOnly,
        setModes,
        setCategoryPhaseMode: setCategoryPhase,
        registerPersistFlush,
        flushPendingPersists,
      }}
    >
      {children}
    </FixtureEditModeContext.Provider>
  );
}

export function useFixtureEditModes() {
  return useContext(FixtureEditModeContext);
}

export function useFixtureEditMode(
  categoryId: string | undefined,
  phase: FixtureEditPhase,
) {
  const { modes, readOnly, setCategoryPhaseMode } = useFixtureEditModes();
  const mode = fixtureEditModeFor(modes, categoryId, phase);
  const isManual = mode === "MANUAL";
  return {
    mode,
    modes,
    isManual,
    scheduleLocked: readOnly || !isManual,
    setMode: (next: FixtureEditMode) => {
      if (!categoryId) return;
      setCategoryPhaseMode(categoryId, phase, next);
    },
  };
}

export function useRegisterFixturePersistFlush(fn: FlushFn) {
  const { registerPersistFlush } = useFixtureEditModes();
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    return registerPersistFlush(() => fnRef.current());
  }, [registerPersistFlush]);
}

export function FixturePersistFlushBinder({
  flushRef,
}: {
  flushRef: { current: () => Promise<void> };
}) {
  const { flushPendingPersists } = useFixtureEditModes();
  flushRef.current = flushPendingPersists;
  return null;
}
