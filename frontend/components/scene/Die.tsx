"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

type DieGLTF = { nodes: { Cube: THREE.Mesh } };

useGLTF.preload("/models/die_body.glb");
useGLTF.preload("/models/die_pips.glb");

// Measured off the real model (frontend/public/models/die_body.glb, sourced from the
// .blend asset) by rendering a static, unrotated instance of the mesh and moving only the
// CAMERA to look from each of the six axis directions in turn -- opposite faces sum to 7.
// Result: +X=3, -X=4, +Y=1, -Y=6, +Z=2, -Z=5.
const FACE_UP_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

// The die's actual authored material (read from the .blend, not re-themed): a red glass
// body (Glass BSDF, color (1,0,0), IOR 1.45, roughness 0) with the pip indents carrying a
// separate white diffuse/glossy material.
const BODY_RED = "#ff0000";
const PIP_WHITE = "#ffffff";

const DIE_SCALE = 0.34;

// A die is only ever mounted once its value is known and the cup has been lifted --
// there's no "sealed, tumbling under the cup" state to render at all, so there's nothing
// that can ever be caught peeking past the cup's silhouette. Instead of simulating a
// physics tumble, it just animates in from just above/behind its slot with a random
// starting spin, settling into the correct face-up orientation -- the "shake the cup and
// dice appear" moment a player actually sees.
export function Die({
  revealSlot,
  value,
}: {
  revealSlot: [number, number, number];
  value: number;
}) {
  const { nodes: bodyNodes } = useGLTF("/models/die_body.glb") as unknown as DieGLTF;
  const { nodes: pipNodes } = useGLTF("/models/die_pips.glb") as unknown as DieGLTF;
  const group = useRef<THREE.Group>(null);
  const progress = useRef(0);

  // The randomized starting pose is a one-time side effect (not a pure render
  // computation), so it's rolled in an effect rather than inline in render/useMemo.
  const startRef = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion } | null>(null);
  useEffect(() => {
    startRef.current = {
      pos: new THREE.Vector3(
        revealSlot[0] + (Math.random() - 0.5) * 0.4,
        revealSlot[1] + 1.4 + Math.random() * 0.6,
        revealSlot[2] + (Math.random() - 0.5) * 0.4
      ),
      quat: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2)
      ),
    };
    progress.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- captured once, at mount, as the animation's starting pose
  }, []);
  const targetPos = useMemo(() => new THREE.Vector3(...revealSlot), [revealSlot]);
  const targetQuat = useMemo(() => {
    const e = FACE_UP_EULER[value] ?? [0, 0, 0];
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
  }, [value]);

  useFrame((_state, delta) => {
    if (!group.current || !startRef.current) return;
    progress.current = Math.min(1, progress.current + delta / 0.55);
    const e = 1 - Math.pow(1 - progress.current, 3); // ease-out cubic
    group.current.position.lerpVectors(startRef.current.pos, targetPos, e);
    group.current.quaternion.slerpQuaternions(startRef.current.quat, targetQuat, e);
  });

  return (
    <group ref={group}>
      <group scale={DIE_SCALE}>
        <mesh geometry={bodyNodes.Cube.geometry} castShadow receiveShadow>
          <MeshTransmissionMaterial
            color={BODY_RED}
            transmission={0.88}
            thickness={0.6}
            roughness={0.05}
            ior={1.45}
            attenuationColor={BODY_RED}
            attenuationDistance={0.8}
            chromaticAberration={0.02}
            samples={4}
            resolution={128}
          />
        </mesh>
        <mesh geometry={pipNodes.Cube.geometry} castShadow receiveShadow>
          <meshStandardMaterial color={PIP_WHITE} roughness={0.45} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}
