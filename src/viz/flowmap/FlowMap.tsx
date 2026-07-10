"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { runEngine } from "@/engine/run";
import { ORDERS } from "@/engine/domain/fixture";
import { type Region } from "@/engine/domain/order";
import { type EngineEvent } from "@/engine/domain/event";
import { projectScene } from "@/viz/projection";
import { stageX, type StageId } from "@/viz/geometry";
import { forkLayout, activeLaneSpike, cancelledLanes } from "@/viz/parallel";
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

/** Region hues — the group key's identity, echoed on pulses, bins, and source cells. */
const REGION_HUE: Record<Region, string> = {
  West: "#38bdf8",
  East: "#34d399",
  North: "#f472b6",
};

/** Per-stage identity: label, the source it names, and its accent hue. */
const STAGE_META: Record<StageId, { label: string; hue: string }> = {
  source: { label: "source", hue: "#38bdf8" },
  filter: { label: "filter", hue: "#4ade80" },
  map: { label: "map", hue: "#fbbf24" },
  terminal: { label: "collect", hue: "#a78bfa" },
};
const STAGE_ORDER: readonly StageId[] = ["source", "filter", "map", "terminal"];

const MONO = '"Roboto Mono", ui-monospace, "SF Mono", Menlo, monospace';
const DEMAND_HUE = "#c4b5fd";
const INK = "#e7ecf8";
const MUTED = "#8b98b4";
const FAINT = "#5a6684";
const PANEL = "rgba(18, 26, 44, 0.72)";

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
    const padX = 92;
    const padTop = 104;
    const padBot = 78;
    const innerW = W - 2 * padX;
    const geoX = (gx: number) => padX + ((gx + 6) / 12) * innerW;
    const bandTop = padTop;
    const bandBot = H - padBot;
    const midY = (bandTop + bandBot) / 2;
    const laneScale = clamp((bandBot - bandTop) / 8, 18, 30);
    const geoY = (gy: number) => midY + gy * laneScale;

    const lanes = parallel
      ? forkLayout(log)
      : [{ lane: "·", y: 0, estimatedSize: metrics.totalPulled }];
    const cancelled = parallel ? cancelledLanes(log, playhead) : new Set<string>();

    // ── section labels (below the HUD's two lines so they never collide) ──
    ctx.textAlign = "center";
    ctx.fillStyle = FAINT;
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("SOURCE", geoX(stageX("source")), 68);
    ctx.fillText("INTERMEDIATE OPS", (geoX(stageX("filter")) + geoX(stageX("map"))) / 2, 68);
    ctx.fillText("TERMINAL", geoX(stageX("terminal")), 68);

    // ── stage columns (behind the conduit) ────────────────────────────────
    const colW = 96;
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
      ctx.font = `600 14px ${MONO}`;
      ctx.fillText(STAGE_META[id].label, x, bandTop + 6);
      ctx.fillStyle = MUTED;
      ctx.font = `10px ${MONO}`;
      ctx.fillText(subFor(id, config), x, bandTop + 22);
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
      bandTop,
      bandBot,
    });

    // ── terminal payload ──────────────────────────────────────────────────
    const termX = geoX(stageX("terminal"));
    if (config.slice === "A") {
      drawBins(ctx, scene.bins, termX + colW / 2 + 16, midY);
    } else if (scene.found) {
      drawFound(ctx, scene.found, termX, bandTop);
    }

    // ── in-flight signal (the beat) ───────────────────────────────────────
    if (parallel) {
      const spike = activeLaneSpike(log, playhead, { reducedMotion });
      if (spike) {
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
    drawHud(ctx, { W, config, metrics, baselineWall });
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

function subFor(id: StageId, config: { slice: "A" | "B"; terminal: "findFirst" | "findAny" }): string {
  if (id === "source") return "orders";
  if (id === "filter") return "total > 100";
  if (id === "map") return "applyDiscount";
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
    roundRect(ctx, x, y, cellW, cellH, 6);
    ctx.fillStyle = dark ? "rgba(120,130,150,0.06)" : pulled ? alpha(hue, 0.1) : alpha(hue, 0.2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? FAINT : pulled ? alpha(hue, 0.25) : alpha(hue, 0.6);
    ctx.stroke();
    ctx.fillStyle = dark ? FAINT : pulled ? MUTED : hue;
    ctx.font = `${pulled ? "500" : "700"} 11px ${MONO}`;
    ctx.fillText(`$${order.total}`, o.x, y + cellH / 2 + 4);
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
) {
  const unit = 12;
  const barW = 24;
  const gap = 10;
  const maxH = 96;
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
  },
) {
  const { W, config, metrics, baselineWall } = o;
  // top-left: run summary
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = `600 11px ${MONO}`;
  const modeText =
    config.mode === "parallel" ? `parallel · ${config.threadCount} lanes` : "sequential";
  const sliceText = config.slice === "A" ? "groupingBy" : config.terminal;
  ctx.fillText(`${modeText}  ·  ${sliceText}`, 24, 22);
  ctx.fillStyle = FAINT;
  ctx.font = `10px ${MONO}`;
  ctx.fillText(
    `pulled ${metrics.pulled}/${ORDERS.length}` +
      (metrics.neverPulled > 0 ? `   ·   ${metrics.neverPulled} never pulled (short-circuit)` : ""),
    24,
    38,
  );

  // top-right: modeled wall-clock
  ctx.textAlign = "right";
  const rx = W - 24;
  ctx.fillStyle = INK;
  ctx.font = `800 24px ${MONO}`;
  ctx.fillText(`${Math.round(metrics.wallElapsed)} ms`, rx, 26);
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(`wall-clock (modeled) · CPU ${metrics.cpuWork} ms`, rx, 42);
  if (config.mode === "parallel" && metrics.wallClock > 0) {
    const speedup = baselineWall / metrics.wallClock;
    const good = speedup >= 1.05;
    const slower = speedup < 0.99;
    ctx.fillStyle = good ? STAGE_META.filter.hue : slower ? "#fb7185" : MUTED;
    ctx.font = `600 11px ${MONO}`;
    ctx.fillText(
      slower ? `${speedup.toFixed(2)}× — slower than 1 lane` : `${speedup.toFixed(2)}× vs 1 lane`,
      rx,
      58,
    );
  }
}
