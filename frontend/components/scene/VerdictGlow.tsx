"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function VerdictGlow({ active, good }: { active: boolean; good: boolean | null }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const intensity = active ? 1.2 + Math.sin(t * 6) * 0.5 : 0;
    if (mat.current) {
      mat.current.emissiveIntensity = intensity;
      mat.current.opacity = active ? 0.85 : 0;
    }
    if (light.current) light.current.intensity = active ? 3 + Math.sin(t * 6) * 1.5 : 0;
  });

  const color = good === false ? "#f97316" : good === true ? "#22c55e" : "#f97316";

  return (
    <>
      <pointLight ref={light} position={[0, 2, 0]} color={color} distance={8} />
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.55, 3.75, 64]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0} transparent opacity={0} />
      </mesh>
    </>
  );
}
