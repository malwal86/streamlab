/**
 * S0.7 AC3 — the engine import boundary, test-enforced. No file under
 * `src/engine/**` may import React / Next / Zustand / the viz / the store. The
 * ESLint `no-restricted-imports` override enforces this at lint time; this test
 * is the belt-and-braces backstop that fails a suite run even if lint is skipped,
 * and documents the boundary where a reader will look for it.
 *
 * The credibility argument depends on the kernel being pure TS: if React ever
 * reached engine code, "the engine is a framework-agnostic Java-faithful
 * simulator" would stop being true. This test makes that regression loud.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ENGINE_DIR = join(process.cwd(), "src", "engine");

/** Every `.ts`/`.tsx` file under the engine, recursively (skips golden JSON, node_modules). */
function engineSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...engineSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Modules the pure kernel must never depend on — the React/UI world. */
const FORBIDDEN = ["react", "react-dom", "next", "zustand", "@react-three", "@/store", "@/viz"];

/** Match a real ES import/re-export of `mod` (exact or subpath), not a mention in prose. */
function importsModule(source: string, mod: string): boolean {
  const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `... from "mod"` / `from "mod/sub"`, and bare `import "mod"`.
  const re = new RegExp(`(from|import)\\s+['"]${escaped}(/[^'"]*)?['"]`);
  return re.test(source);
}

describe("engine import boundary (S0.7 AC3)", () => {
  const files = engineSourceFiles(ENGINE_DIR);

  it("finds engine source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no engine file imports React / Next / Zustand / viz / store", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const mod of FORBIDDEN) {
        if (importsModule(source, mod)) {
          offenders.push(`${file.replace(process.cwd() + "/", "")} imports "${mod}"`);
        }
      }
    }
    expect(offenders, `engine boundary violated:\n${offenders.join("\n")}`).toEqual([]);
  });
});
