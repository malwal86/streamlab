// @ts-check
/**
 * Mutation testing (S0.2), scoped to the engine kernel only.
 *
 * Stryker mutates `src/engine` and re-runs the Vitest suite per mutant: a
 * *surviving* mutant is code we could break without any test noticing (R4). The
 * viz/store/app layers are out of scope — the engine is the credibility spine,
 * so that is where mutants must die. Test scaffolding under `testing/` and the
 * committed goldens are excluded from mutation.
 *
 * Run with `npm run mutation`. Today the engine holds only the S0.3 domain model
 * (value/order/fixture), so this proves the toolchain reports; the score becomes
 * load-bearing as real ops land (S1.1+).
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  packageManager: "npm",
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  coverageAnalysis: "perTest",
  mutate: [
    "src/engine/**/*.ts",
    "!src/engine/**/*.{test,spec}.ts",
    "!src/engine/testing/**",
    "!src/engine/**/*.d.ts",
  ],
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  // No break threshold yet — the near-empty engine would make it meaningless.
  // Tighten (e.g. `break: 80`) once real ops land in E1.
  thresholds: { high: 90, low: 70, break: null },
  ignorePatterns: ["out", ".next", "coverage", "reports", "node_modules"],
};
