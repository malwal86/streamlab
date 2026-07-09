"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { Mesh } from "three";
import { useAppStore } from "@/store/appStore";

/** A single inert soma — a stand-in for the source node (real scene: S1.4). */
function Soma() {
  const ref = useRef<Mesh>(null);
  const idleSpin = useAppStore((s) => s.idleSpin);

  useFrame((_, delta) => {
    if (idleSpin && ref.current) ref.current.rotation.y += delta * 0.3;
  });

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#4f9dff" wireframe emissive="#123" />
    </mesh>
  );
}

/**
 * Placeholder WebGL canvas stub (S0.1). Proves the three / R3F / drei /
 * postprocessing / zustand toolchain mounts and renders client-side.
 */
export default function ConduitCanvas() {
  return (
    <Canvas data-testid="conduit-canvas" camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={40} />
      <Soma />
      <OrbitControls enablePan={false} />
      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
