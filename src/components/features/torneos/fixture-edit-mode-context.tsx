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
  fixtureEditModeForCategory,
  parseFixtureEditModes,
  type FixtureEditMode,
  type FixtureEditModes,
} from "@/modules/tournaments/domain/fixture-edit-mode";

type FlushFn = () => Promise<unknown>;

type FixtureEditModeContextValue = {
  modes: FixtureEditModes;
  readOnly: boolean;
  setModes: (modes: FixtureEditModes) => void;
  setCategoryMode: (categoryId: string, mode: FixtureEditMode) => void;
  registerPersistFlush: (fn: FlushFn) => () => void;
  flushPendingPersists: () => Promise<void>;
};

const FixtureEditModeContext = createContext<FixtureEditModeContextValue>({
  modes: DEFAULT_FIXTURE_EDIT_MODES,
  readOnly: false,
  setModes: () => {},
  setCategoryMode: () => {},
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

  const setCategoryMode = useCallback(
    (categoryId: string, mode: FixtureEditMode) => {
      setModes({ ...parsed, [categoryId]: mode });
    },
    [parsed, setModes],
  );

  return (
    <FixtureEditModeContext.Provider
      value={{
        modes: parsed,
        readOnly,
        setModes,
        setCategoryMode,
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

export function useFixtureEditMode(categoryId: string | undefined) {
  const { modes, readOnly, setCategoryMode } = useFixtureEditModes();
  const mode = fixtureEditModeForCategory(modes, categoryId);
  const isManual = mode === "MANUAL";
  return {
    mode,
    modes,
    isManual,
    scheduleLocked: readOnly || !isManual,
    setMode: (next: FixtureEditMode) => {
      if (!categoryId) return;
      setCategoryMode(categoryId, next);
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
