/**
 * Golden event-log snapshot harness (S0.2).
 *
 * A golden is the canonical serialization of an engine event log, committed
 * under `src/engine/__golden__/`. Tests assert the live log serializes to the
 * committed bytes; a real diff means a real behavior change (R4). Regenerate
 * intentionally with `UPDATE_GOLDEN=1 npm run test:golden`.
 *
 * This is a thin, framework-agnostic file-compare — it deliberately does not use
 * Vitest's built-in snapshotting so the serialization contract (sorted keys,
 * normalized floats) lives in one auditable place (`serialize.ts`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect } from "vitest";
import { serializeLog } from "./serialize";

/**
 * Absolute path to the committed golden directory. Resolved from the project
 * root (Vitest and Stryker both run there) rather than `import.meta.url`, which
 * is not a stable `file://` URL under the bundler.
 */
export const GOLDEN_DIR = join(process.cwd(), "src", "engine", "__golden__");

const shouldUpdate = process.env.UPDATE_GOLDEN === "1" || process.env.UPDATE_GOLDEN === "true";

function goldenPath(name: string): string {
  if (!/^[\w./-]+$/.test(name)) {
    throw new Error(`Invalid golden name: ${JSON.stringify(name)}`);
  }
  return join(GOLDEN_DIR, `${name}.json`);
}

/**
 * Assert `log` matches the committed golden `name`. When `UPDATE_GOLDEN` is set,
 * or the golden does not yet exist, it is (re)written instead of compared.
 */
export function assertMatchesGolden(name: string, log: unknown): void {
  const serialized = serializeLog(log);
  const file = goldenPath(name);

  if (shouldUpdate || !existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, serialized, "utf8");
    return;
  }

  const expected = readFileSync(file, "utf8");
  // Compare canonical strings so failures surface as a readable line diff.
  expect(
    serialized,
    `golden mismatch for "${name}" (run \`UPDATE_GOLDEN=1 npm run test:golden\` to refresh)`,
  ).toBe(expected);
}
