import { create } from "zustand";

/**
 * Minimal smoke store (S0.1). Proves the Zustand wiring and the `@/store` path
 * alias resolve. The real `config + eventLog + playhead` store lands in S0.7.
 */
interface AppState {
  /** Whether the placeholder soma should idle-rotate. */
  idleSpin: boolean;
  setIdleSpin: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  idleSpin: true,
  setIdleSpin: (value) => set({ idleSpin: value }),
}));
