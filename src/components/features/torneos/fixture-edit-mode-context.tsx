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
  parseFixtureEditMode,
  type FixtureEditMode,
} from "@/modules/tournaments/domain/fixture-edit-mode";

type FlushFn = () => Promise<unknown>;

type FixtureEditModeContextValue = {
  mode: FixtureEditMode;
  isManual: boolean;
  scheduleLocked: boolean;
  setMode: (mode: FixtureEditMode) => void;
  registerPersistFlush: (fn: FlushFn) => () => void;
  flushPendingPersists: () => Promise<void>;
};

const FixtureEditModeContext = createContext<FixtureEditModeContextValue>({
  mode: "AUTO",
  isManual: false,
  scheduleLocked: true,
  setMode: () => {},
  registerPersistFlush: () => () => {},
  flushPendingPersists: async () => {},
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

  return (
    <FixtureEditModeContext.Provider
      value={{
        mode: parsed,
        isManual,
        scheduleLocked: readOnly || !isManual,
        setMode,
        registerPersistFlush,
        flushPendingPersists,
      }}
    >
      {children}
    </FixtureEditModeContext.Provider>
  );
}

export function useFixtureEditMode() {
  return useContext(FixtureEditModeContext);
}

export function useRegisterFixturePersistFlush(fn: FlushFn) {
  const { registerPersistFlush } = useFixtureEditMode();
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
  const { flushPendingPersists } = useFixtureEditMode();
  flushRef.current = flushPendingPersists;
  return null;
}
