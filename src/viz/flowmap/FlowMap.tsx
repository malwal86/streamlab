"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { runEngine } from "@/engine/run";
import { ORDERS } from "@/engine/domain/fixture";
import { type Region } from "@/engine/domain/order";
import { type EngineEvent } from "@/engine/domain/event";
import { projectScene } from "@/viz/projection";
import { stageX, type StageId } from "@/viz/geometry";
import { forkLayout, parallelLaneSpikes, cancelledLanes } from "@/viz/parallel";
import { flowMetrics } from "./metrics";
import styles from "./flowmap.module.css";

/**
 * The **flow-map interface** (the 2D home view): a left→right rendering of the
 * `source → filter → map → collect` conduit, driven entirely by the engine's event
 * log at the current playhead. Every mark it draws is a pure read of that log —
 * `projectScene` for the in-flight pulse / bins / FOUND latch / dark never-pulled
 * source slots, the parallel projections (`forkLayout` / `activeLaneSpike` /
 * `cancelledLanes`) for the lanes, and `flowMetrics` for the read-out — so the view
 * can never show an outcome the engine did not produce (R2). It keeps the signature
 * thesis literal: the retrograde `demand` spike is drawn traveling *backwards*,
 * terminal → source, ahead of each element's forward journey.
 *
 * Canvas (not SVG/DOM) so the per-frame pulse stays cheap; all state comes from the
 * store, so the transport, controls, and code panel drive it unchanged.
 */

/** Region hues — the group key's identity, echoed on pulses, bins, and source cells.
    Chosen to read on a white ground and to carry white label text on the pulse. */
const REGION_HUE: Record<Region, string> = {
  West: "#0284c7",
  East: "#059669",
  North: "#db2777",
};

/** Per-stage identity: label, the source it names, and its accent hue. */
const STAGE_META: Record<StageId, { label: string; hue: string }> = {
  source: { label: "source", hue: "#0284c7" },
  filter: { label: "filter", hue: "#059669" },
  map: { label: "map", hue: "#d97706" },
  terminal: { label: "collect", hue: "#7c3aed" },
};
const STAGE_ORDER: readonly StageId[] = ["source", "filter", "map", "terminal"];

const MONO = '"Roboto Mono", ui-monospace, "SF Mono", Menlo, monospace';
const DEMAND_HUE = "#7c3aed";
const INK = "#16203a";
const MUTED = "#55627d";
const FAINT = "#94a1b8";
const PANEL = "rgba(20, 40, 90, 0.045)";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** The `emit` payload for an element (region + pre-map total), or null if never emitted. */
function payloadOf(log: readonly EngineEvent[], id: number): { region: Region; total: number } | null {
  const e = log.find((ev) => ev.kind === "emit" && ev.elementId === id);
  return e && e.kind === "emit" ? { region: e.input.region, total: e.input.total } : null;
}

export function FlowMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 460 });

  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const config = useAppStore((s) => s.config);

  // Baseline: the same pipeline run sequentially, so the parallel wall-clock has a
  // "vs 1 thread" figure to quote. A pure engine re-run, memoized on what changes it.
  const baselineWall = useMemo(
    () => flowMetrics(runEngine({ ...config, mode: "sequential" }), Infinity).wallClock,
    [config],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || size.w === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = size.w;
    const H = size.h;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const scene = projectScene(log, playhead, { reducedMotion });
    const metrics = flowMetrics(log, playhead);
    const parallel = config.mode === "parallel";

    // ── coordinate mapping: geometry space (x∈[-6,6]) → canvas ─────────────
    // Asymmetric padding: the terminal sits at the right edge of geometry space
    // (gx = 6), and the grouping bins (West/East/North towers) draw *past* it, so
    // the right side needs far more room than the left. A wider right pad shifts
    // the whole pipeline left and gives every final group space to fan out.
    //
    // Narrow (phone) canvases get a `compact` layout: tighter paddings, smaller
    // type, and — crucially — a stage column that is clamped to just under the
    // stage spacing so the four columns never collapse into each other when the
    // pipeline is squeezed into ~300–400px of width.
    const compact = W < 700;
    const padL = compact ? 34 : 92;
    const padR = compact ? 128 : 200;
    const innerW = Math.max(1, W - padL - padR);
    const geoX = (gx: number) => padL + ((gx + 6) / 12) * innerW;
    const stageSpacing = innerW / 3; // distance between adjacent stage centers
    const colW = clamp(compact ? 56 : 96, 40, stageSpacing - 6);
    const fsStage = compact ? 12 : 14;
    const fsSub = compact ? 9 : 10;
    // Cap the pipeline's depth and center it vertically — it needn't fill a tall
    // canvas, so on a big screen it stays a compact band with breathing room.
    const topReserve = 96; // HUD + section labels sit above the band
    const botReserve = 48;
    const availH = H - topReserve - botReserve;
    const bandH = Math.min(availH, 360);
    const bandTop = topReserve + (availH - bandH) / 2;
    const bandBot = bandTop + bandH;
    const midY = (bandTop + bandBot) / 2;
    const laneScale = clamp(bandH / 8, 18, 30);
    const geoY = (gy: number) => midY + gy * laneScale;

    const lanes = parallel
      ? forkLayout(log)
      : [{ lane: "·", y: 0, estimatedSize: metrics.totalPulled }];
    const cancelled = parallel ? cancelledLanes(log, playhead) : new Set<string>();

    // ── section labels, just above the (centered) band ────────────────────
    // On a phone the three section captions would overlap the tight columns and
    // duplicate the per-stage headers, so they are dropped in the compact layout.
    if (!compact) {
      const labelY = bandTop - 24;
      ctx.textAlign = "center";
      ctx.fillStyle = FAINT;
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText("SOURCE", geoX(stageX("source")), labelY);
      ctx.fillText("INTERMEDIATE OPS", (geoX(stageX("filter")) + geoX(stageX("map"))) / 2, labelY);
      ctx.fillText("TERMINAL", geoX(stageX("terminal")), labelY);
    }

    // ── stage columns (behind the conduit) ────────────────────────────────
    for (const id of STAGE_ORDER) {
      const x = geoX(stageX(id));
      const hue = STAGE_META[id].hue;
      ctx.fillStyle = PANEL;
      roundRect(ctx, x - colW / 2, bandTop - 14, colW, bandBot - bandTop + 28, 14);
      ctx.fill();
      ctx.strokeStyle = alpha(hue, 0.28);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = hue;
      roundRect(ctx, x - colW / 2 + 1, bandTop - 13, colW - 2, 4, 2);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = hue;
      ctx.font = `600 ${fsStage}px ${MONO}`;
      ctx.fillText(STAGE_META[id].label, x, bandTop + 6);
      ctx.fillStyle = MUTED;
      ctx.font = `${fsSub}px ${MONO}`;
      ctx.fillText(subFor(id, config, compact), x, bandTop + 22);
    }

    // ── lane conduits ─────────────────────────────────────────────────────
    for (const lane of lanes) {
      const y = geoY(lane.y);
      const dead = cancelled.has(lane.lane);
      const grad = ctx.createLinearGradient(geoX(stageX("source")), 0, geoX(stageX("terminal")), 0);
      grad.addColorStop(0, STAGE_META.source.hue);
      grad.addColorStop(0.4, STAGE_META.filter.hue);
      grad.addColorStop(0.7, STAGE_META.map.hue);
      grad.addColorStop(1, STAGE_META.terminal.hue);
      ctx.globalAlpha = dead ? 0.18 : 0.9;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(geoX(stageX("filter")), y);
      ctx.lineTo(geoX(stageX("terminal")), y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (const id of STAGE_ORDER) {
        ctx.beginPath();
        ctx.arc(geoX(stageX(id)), y, 4, 0, 7);
        ctx.fillStyle = dead ? FAINT : STAGE_META[id].hue;
        ctx.fill();
      }
      if (parallel) {
        ctx.textAlign = "right";
        ctx.fillStyle = dead ? FAINT : MUTED;
        ctx.font = `600 10px ${MONO}`;
        ctx.fillText(dead ? `${lane.lane} ✕` : lane.lane, geoX(stageX("source")) - colW / 2 - 8, y + 3);
      }
    }

    // ── source tray: every order, dimming as it is pulled ─────────────────
    drawSourceTray(ctx, {
      log,
      index: metrics.index,
      x: geoX(stageX("source")),
      colW,
      bandTop: bandTop + 34, // clear the "source / orders" column header
      bandBot,
    });

    // ── terminal payload ──────────────────────────────────────────────────
    const termX = geoX(stageX("terminal"));
    if (config.slice === "A") {
      drawBins(ctx, scene.bins, termX + colW / 2 + 16, midY, compact);
    } else if (scene.found) {
      drawFound(ctx, scene.found, termX, bandTop);
    }

    // ── in-flight signals (the beat) ──────────────────────────────────────
    if (parallel) {
      // Every lane at once — real ForkJoin threads run concurrently.
      for (const spike of parallelLaneSpikes(log, playhead, { reducedMotion })) {
        const x = geoX(spike.x);
        const y = geoY(spike.y);
        if (spike.kind === "demand") {
          drawDemand(ctx, x, y);
        } else if (spike.elementId !== undefined) {
          const p = payloadOf(log, spike.elementId);
          if (p) drawPulse(ctx, x, y, spike.elementId, p.total, p.region, 1);
        }
      }
    } else {
      if (scene.demandSpike) drawDemand(ctx, geoX(scene.demandSpike.x), midY);
      if (scene.pulse) {
        const pu = scene.pulse;
        drawPulse(ctx, geoX(pu.x), midY, pu.elementId, pu.total, pu.region, pu.opacity);
        if (scene.filterReadout) {
          ctx.textAlign = "center";
          ctx.fillStyle = scene.filterReadout.passed ? STAGE_META.filter.hue : "#fb7185";
          ctx.font = `600 12px ${MONO}`;
          ctx.fillText(scene.filterReadout.text, geoX(stageX("filter")), midY - 26);
        }
      }
    }

    // ── HUD: run summary + modeled wall-clock ─────────────────────────────
    drawHud(ctx, { W, config, metrics, baselineWall, compact });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }, [log, playhead, reducedMotion, config, size, baselineWall]);

  return (
    <div className={styles.root} ref={rootRef}>
      <canvas className={styles.canvas} ref={canvasRef} aria-label="Java stream pipeline flow-map: orders pulled through filter, map, and the terminal collector, sequentially or across parallel lanes." />
    </div>
  );
}

// ── canvas helpers ────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function subFor(
  id: StageId,
  config: { slice: "A" | "B"; terminal: "findFirst" | "findAny" },
  compact = false,
): string {
  // On a phone the columns are too narrow for the full expressions, so the
  // captions shrink to the essential token — the code panel below shows the rest.
  if (id === "source") return "orders";
  if (id === "filter") return compact ? "> 100" : "total > 100";
  if (id === "map") return compact ? "discount" : "applyDiscount";
  return config.slice === "A" ? "groupingBy" : `${config.terminal}()`;
}

/** The source tray — all 11 fixture orders; consumed ones dim, never-pulled go dark. */
function drawSourceTray(
  ctx: CanvasRenderingContext2D,
  o: { log: readonly EngineEvent[]; index: number; x: number; colW: number; bandTop: number; bandBot: number },
) {
  const emittedAll = new Set<number>();
  const emittedSoFar = new Set<number>();
  o.log.forEach((e, i) => {
    if (e.kind === "emit") {
      emittedAll.add(e.elementId);
      if (i <= o.index) emittedSoFar.add(e.elementId);
    }
  });
  const shortCircuited = emittedAll.size < ORDERS.length;

  const n = ORDERS.length;
  const gap = 6;
  const avail = o.bandBot - o.bandTop;
  const cellH = clamp((avail - (n - 1) * gap) / n, 16, 26);
  const cellW = o.colW - 20;
  const x = o.x - cellW / 2;
  const totalH = n * cellH + (n - 1) * gap;
  let y = o.bandTop + (avail - totalH) / 2;

  ctx.textAlign = "center";
  for (const order of ORDERS) {
    const hue = REGION_HUE[order.region];
    const pulled = emittedSoFar.has(order.id);
    const dark = shortCircuited && !emittedAll.has(order.id);
    const cy = y + cellH / 2;

    // Cell slot. A consumed order reads as an emptied, ghosted slot — a nearly
    // clear fill and a dashed outline — so "already pulled" is unmistakable
    // against the solid, saturated cells still waiting to be consumed.
    roundRect(ctx, x, y, cellW, cellH, 6);
    ctx.fillStyle = dark ? "rgba(120,130,150,0.05)" : pulled ? alpha(hue, 0.05) : alpha(hue, 0.22);
    ctx.fill();
    ctx.lineWidth = pulled && !dark ? 1 : 1.25;
    ctx.strokeStyle = dark ? FAINT : pulled ? alpha(hue, 0.4) : alpha(hue, 0.7);
    if (pulled && !dark) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Value.
    ctx.fillStyle = dark ? FAINT : pulled ? FAINT : hue;
    ctx.font = `${pulled ? "500" : "700"} 11px ${MONO}`;
    const label = `$${order.total}`;
    const labelX = pulled && !dark ? o.x - 5 : o.x; // nudge to make room for the ✓
    ctx.fillText(label, labelX, cy + 4);

    // Consumed marker: strike the value through and stamp a check in the corner.
    if (pulled && !dark) {
      const w = ctx.measureText(label).width;
      ctx.strokeStyle = alpha(hue, 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(labelX - w / 2 - 2, cy);
      ctx.lineTo(labelX + w / 2 + 2, cy);
      ctx.stroke();
      ctx.fillStyle = hue;
      ctx.font = `700 10px ${MONO}`;
      ctx.fillText("✓", x + cellW - 9, cy + 3.5);
    }
    y += cellH + gap;
  }
}

/** The retrograde demand spike — drawn traveling backwards (the signature thesis). */
function drawDemand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = alpha(DEMAND_HUE, 0.55);
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 26, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = DEMAND_HUE;
  ctx.shadowColor = DEMAND_HUE;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 2, y - 5);
  ctx.lineTo(x + 2, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A forward element pulse — region-hued token carrying its (discounted) total. */
function drawPulse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number,
  total: number,
  region: Region,
  opacity: number,
) {
  const hue = REGION_HUE[region];
  ctx.save();
  ctx.globalAlpha = clamp(opacity, 0, 1);
  ctx.shadowColor = hue;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, 7);
  ctx.fillStyle = hue;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0b0f1a";
  ctx.font = `700 11px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`$${Math.round(total)}`, x, y + 0.5);
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

/** Region bins — the grouping terminal's growing towers (Slice A). */
function drawBins(
  ctx: CanvasRenderingContext2D,
  bins: readonly { region: Region; count: number }[],
  x: number,
  midY: number,
  compact = false,
) {
  const unit = compact ? 10 : 12;
  const barW = compact ? 18 : 24;
  const gap = compact ? 7 : 10;
  const maxH = compact ? 72 : 96;
  let bx = x;
  ctx.textAlign = "center";
  for (const bin of bins) {
    const hue = REGION_HUE[bin.region];
    const h = Math.min(maxH, bin.count * unit);
    const base = midY + maxH / 2;
    roundRect(ctx, bx, base - h, barW, h, 4);
    ctx.fillStyle = alpha(hue, 0.5);
    ctx.fill();
    ctx.strokeStyle = alpha(hue, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = hue;
    ctx.font = `700 12px ${MONO}`;
    ctx.fillText(String(Math.floor(bin.count)), bx + barW / 2, base - h - 6);
    ctx.fillStyle = MUTED;
    ctx.font = `9px ${MONO}`;
    ctx.fillText(bin.region, bx + barW / 2, base + 14);
    bx += barW + gap;
  }
}

/** The FOUND latch — the short-circuit payoff (Slice B). */
function drawFound(
  ctx: CanvasRenderingContext2D,
  found: { elementId: number; region: Region; total: number },
  x: number,
  bandTop: number,
) {
  const hue = REGION_HUE[found.region];
  const y = bandTop + 40;
  ctx.textAlign = "center";
  ctx.save();
  ctx.shadowColor = hue;
  ctx.shadowBlur = 20;
  roundRect(ctx, x - 58, y, 116, 46, 10);
  ctx.fillStyle = alpha(hue, 0.16);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hue;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x - 58, y, 116, 46, 10);
  ctx.stroke();
  ctx.fillStyle = hue;
  ctx.font = `700 13px ${MONO}`;
  ctx.fillText(`FOUND #${found.elementId}`, x, y + 20);
  ctx.fillStyle = MUTED;
  ctx.font = `10px ${MONO}`;
  ctx.fillText(`${found.region} · $${found.total}`, x, y + 36);
}

/** The corner HUD: what ran, and the modeled wall-clock (with the parallel speed-up). */
function drawHud(
  ctx: CanvasRenderingContext2D,
  o: {
    W: number;
    config: { slice: "A" | "B"; mode: "sequential" | "parallel"; threadCount: 2 | 4; terminal: "findFirst" | "findAny" };
    metrics: ReturnType<typeof flowMetrics>;
    baselineWall: number;
    compact?: boolean;
  },
) {
  const { W, config, metrics, baselineWall, compact = false } = o;
  // Tighter insets and type on a phone, so the left run-summary and the right
  // wall-clock read-out never collide across the narrow canvas.
  const pad = compact ? 12 : 24;
  // top-left: run summary
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${compact ? 10 : 11}px ${MONO}`;
  const modeText =
    config.mode === "parallel" ? `parallel · ${config.threadCount} lanes` : "sequential";
  const sliceText = config.slice === "A" ? "groupingBy" : config.terminal;
  ctx.fillText(`${modeText}  ·  ${sliceText}`, pad, 22);
  ctx.fillStyle = FAINT;
  ctx.font = `${compact ? 9 : 10}px ${MONO}`;
  // The short-circuit note is abbreviated on a phone so it stays clear of the
  // right-aligned CPU read-out on the same line.
  const shortNote = metrics.neverPulled > 0
    ? compact
      ? `   ·   ${metrics.neverPulled} skipped`
      : `   ·   ${metrics.neverPulled} never pulled (short-circuit)`
    : "";
  ctx.fillText(`pulled ${metrics.pulled}/${ORDERS.length}${shortNote}`, pad, 38);

  // top-right: modeled wall-clock
  ctx.textAlign = "right";
  const rx = W - pad;
  ctx.fillStyle = INK;
  ctx.font = `800 ${compact ? 19 : 24}px ${MONO}`;
  ctx.fillText(`${Math.round(metrics.wallElapsed)} ms`, rx, 26);
  ctx.font = `${compact ? 9 : 10}px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(
    compact ? `wall-clock · CPU ${metrics.cpuWork} ms` : `wall-clock (modeled) · CPU ${metrics.cpuWork} ms`,
    rx,
    42,
  );
  if (config.mode === "parallel" && metrics.wallClock > 0) {
    const speedup = baselineWall / metrics.wallClock;
    const good = speedup >= 1.05;
    const slower = speedup < 0.99;
    ctx.fillStyle = good ? STAGE_META.filter.hue : slower ? "#fb7185" : MUTED;
    ctx.font = `600 ${compact ? 10 : 11}px ${MONO}`;
    ctx.fillText(
      slower ? `${speedup.toFixed(2)}× slower than 1 lane` : `${speedup.toFixed(2)}× vs 1 lane`,
      rx,
      58,
    );
  }
}
