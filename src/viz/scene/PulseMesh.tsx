"use client";

import { Html } from "@react-three/drei";
import { pulseLabel, pulseRadius, regionHue } from "../encoding";
import { type Pulse } from "../projection";

/**
 * The forward element pulse (S1.6): a glowing sphere whose **hue = region** and
 * **radius ∝ total**, with a **DOM label riding it** (`"▲ $1200 · West"`). Every
 * visual is a pure function of the pulse's payload (AC4). The label carries region
 * as glyph + name, so survival/region read without color (spec §3.7); it is DOM
 * (drei `Html`), not WebGL text, and stays crisp as it tracks the 3D position.
 */
export function PulseMesh({ pulse }: { pulse: Pulse }) {
  const hue = regionHue(pulse.region);
  const radius = pulseRadius(pulse.total);
  // Survivors brighten as they clear the filter (S1.7); a dying pulse fades out.
  const emissiveIntensity = pulse.kind === "survive" ? 3.4 : 2.2;

  return (
    <group position={[pulse.x, pulse.y, pulse.z]}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={hue}
          emissive={hue}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={pulse.opacity}
          toneMapped={false}
        />
      </mesh>
      <Html
        center
        position={[0, radius + 0.42, 0]}
        distanceFactor={12}
        style={{
          pointerEvents: "none",
          padding: "2px 7px",
          borderRadius: "6px",
          background: "rgba(8, 12, 22, 0.78)",
          border: `1px solid ${hue}66`,
          color: "#eaf1ff",
          font: "600 12px ui-monospace, SFMono-Regular, Menlo, monospace",
          whiteSpace: "nowrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          opacity: pulse.opacity,
        }}
      >
        {pulseLabel(pulse.total, pulse.region)}
      </Html>
    </group>
  );
}
