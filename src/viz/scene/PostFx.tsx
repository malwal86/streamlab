"use client";

import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing";
import { useAppStore } from "@/store/appStore";
import { postFx } from "../postfx";
import { useScene } from "./useScene";

/**
 * The postprocessing composer (S5.2): **bloom** on the emissive neurons/pulse plus
 * a **depth-of-field** pass whose focal plane follows the single active pulse, so
 * the viewer's eye is drawn to the one element in motion (AC1). All policy is the
 * pure {@link postFx} decision — this component only reads the current pulse and the
 * reduced-motion flag from the store and renders what it returns.
 *
 * Under reduced motion `postFx` returns `{ enabled: false }` and this renders
 * nothing: no bloom, no blur (AC3, spec §3.7). Because DoF only re-targets a vector
 * each beat (no extra geometry), the pass stays within the frame budget (AC2). Lives
 * inside the Canvas (mounted by {@link import("./ConduitScene").ConduitScene}).
 */
export function PostFx() {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const { pulse } = useScene();
  const config = postFx(reducedMotion, pulse);

  if (!config.enabled) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={config.bloom.intensity}
        luminanceThreshold={config.bloom.luminanceThreshold}
        mipmapBlur
      />
      <DepthOfField
        target={config.dof.target}
        focalLength={config.dof.focalLength}
        bokehScale={config.dof.bokehScale}
      />
    </EffectComposer>
  );
}
