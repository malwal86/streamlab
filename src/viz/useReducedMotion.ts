"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";

/**
 * Sync the OS `prefers-reduced-motion` setting into the store (S1.11). Mounted once
 * at the page root: it reads the media query, mirrors it to `reducedMotion`, and
 * listens for live changes (a user toggling the OS setting reflows the demo without
 * a reload). The store flag is what the projection reads to snap instead of animate,
 * so honoring the preference is a single source of truth, not scattered `matchMedia`
 * calls. SSR-safe: does nothing until mounted in the browser.
 */
export function useSyncReducedMotion(): void {
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);

  useEffect(() => {
    // Guarded: some environments (jsdom in tests, very old browsers) lack matchMedia.
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [setReducedMotion]);
}
