/**
 * S0.6 self-tests: pin the oracle's outcomes on the frozen fixture (AC1), prove
 * `assertEqualsOracle` catches a wrong engine (AC3 + the meta-test the story
 * names), and guard the oracle's *independence* from engine internals (AC4) —
 * the property the whole equality argument rests on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import {
  assertEqualsOracle,
  oracleFilter,
  oracleFindFirst,
  oracleGroupingBy,
  oracleMap,
  oracleSurvivors,
} from "./oracle";

/** Survivor ids on the fixture, hand-computed from the curation table (`total > 100`). */
const SURVIVOR_IDS = [2, 4, 5, 6, 7, 9, 11];

describe("oracle outcomes on the frozen fixture (AC1)", () => {
  it("filter keeps exactly the survivors, in encounter order", () => {
    expect(oracleFilter(ORDERS).map((o) => o.id)).toEqual(SURVIVOR_IDS);
  });

  it("filter drops the boundary orders 99 and exactly-100 (strict `>`)", () => {
    const survivingIds = new Set(oracleFilter(ORDERS).map((o) => o.id));
    expect(survivingIds.has(8)).toBe(false); // total 99
    expect(survivingIds.has(10)).toBe(false); // total exactly 100
  });

  it("map applies 10% off with int truncation, order and id preserved", () => {
    const mapped = oracleMap(oracleFilter(ORDERS));
    expect(mapped.map((o) => o.id)).toEqual(SURVIVOR_IDS);
    // 1200→1080, 450→405, 300→270, 150→135, 600→540, 2000→1800, 250→225
    expect(mapped.map((o) => o.total)).toEqual([1080, 405, 270, 135, 540, 1800, 225]);
  });

  it("groupingBy bins survivors by region, in first-seen key order", () => {
    const bins = oracleGroupingBy(oracleFilter(ORDERS));
    expect([...bins.keys()]).toEqual(["West", "East", "North"]);
    expect(bins.get("West")?.map((o) => o.id)).toEqual([2, 6, 11]);
    expect(bins.get("East")?.map((o) => o.id)).toEqual([4, 7]);
    expect(bins.get("North")?.map((o) => o.id)).toEqual([5, 9]);
  });

  it("findFirst returns the earliest survivor (fixture TARGET, id 2)", () => {
    expect(oracleFindFirst(ORDERS)?.id).toBe(2);
  });

  it("findFirst on an all-dying stream returns undefined", () => {
    const allDie = ORDERS.filter((o) => o.total <= 100);
    expect(oracleFindFirst(allDie)).toBeUndefined();
  });

  it("survivor pool (findAny membership) is the full filtered set", () => {
    expect(oracleSurvivors(ORDERS).map((o) => o.id)).toEqual(SURVIVOR_IDS);
  });
});

describe("assertEqualsOracle (AC3 + the story's meta-test)", () => {
  it("passes when the engine agrees with the oracle", () => {
    // A trivially-correct "engine": recompute the same outcome independently.
    const engineSurvivors = ORDERS.filter((o) => o.total > 100);
    expect(() => assertEqualsOracle(engineSurvivors, oracleFilter(ORDERS), "filter")).not.toThrow();
  });

  it("fails a deliberately wrong engine stub (adds instead of discounting)", () => {
    // Wrong map: +10% instead of −10%. assertEqualsOracle must reject it.
    const wrongMapped = oracleFilter(ORDERS).map((o) => ({
      ...o,
      total: o.total + Math.trunc(o.total / 10),
    }));
    expect(() => assertEqualsOracle(wrongMapped, oracleMap(oracleFilter(ORDERS)), "map")).toThrow();
  });

  it("fails an off-by-one filter stub (`>=` instead of `>`)", () => {
    // The `>= 100` mutant lets the exactly-100 order (id 10) survive.
    const wrongFilter = ORDERS.filter((o) => o.total >= 100);
    expect(() => assertEqualsOracle(wrongFilter, oracleFilter(ORDERS), "filter")).toThrow();
  });
});

describe("oracle independence from the engine (AC4 / technical note)", () => {
  it("imports no engine kernel internals or the shared discount/threshold", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "engine", "testing", "oracle.ts"),
      "utf8",
    );
    // Scan only the `import`/`from` statements — prose in doc comments *names*
    // these deliberately to explain why they are avoided, and must not trip this.
    const importLines = source
      .split("\n")
      .filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line));
    // A circular oracle would re-use the very code it is meant to check.
    for (const forbidden of [
      "kernel/runner",
      "kernel/sink",
      "kernel/spliterator",
      "applyDiscount",
      "FILTER_THRESHOLD",
    ]) {
      for (const line of importLines) {
        expect(line, `oracle must not import \`${forbidden}\``).not.toContain(forbidden);
      }
    }
  });
});
