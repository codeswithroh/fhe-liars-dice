"use client";

import { useCallback, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, MeshTransmissionMaterial } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

type DieGLTF = { nodes: { Cube: THREE.Mesh } };

useGLTF.preload("/models/die_body.glb");
useGLTF.preload("/models/die_pips.glb");

// Same authored colors as the in-game die (components/scene/Die.tsx) -- a landing-page
// showcase shouldn't look like a different product than the table you actually play at.
const BODY_RED = "#ff0000";
const PIP_WHITE = "#ffffff";

type DragState = { index: number; grabOffset: THREE.Vector3 } | null;

function HeroDie({
  index,
  startPosition,
  registerBody,
  onGrab,
}: {
  index: number;
  startPosition: [number, number, number];
  registerBody: (index: number, body: RapierRigidBody | null) => void;
  onGrab: (index: number, worldPoint: THREE.Vector3) => void;
}) {
  const { nodes: bodyNodes } = useGLTF("/models/die_body.glb") as unknown as DieGLTF;
  const { nodes: pipNodes } = useGLTF("/models/die_pips.glb") as unknown as DieGLTF;
  // Stable per-instance random spin, computed once (not on every render) so it satisfies
  // the "no impure calls during render" rule while still varying die to die.
  const [initialRotation] = useState<[number, number, number]>(() => [
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI,
  ]);

  return (
    <RigidBody
      ref={(r) => registerBody(index, r)}
      position={startPosition}
      rotation={initialRotation}
      colliders={false}
      restitution={0.3}
      friction={0.7}
      linearDamping={0.4}
      angularDamping={0.5}
      ccd
    >
      <CuboidCollider args={[0.47, 0.47, 0.47]} />
      <group
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          onGrab(index, e.point);
        }}
        onPointerOver={() => (document.body.style.cursor = "grab")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
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
    </RigidBody>
  );
}

function DiceRig() {
  const bodyRefs = useRef<(RapierRigidBody | null)[]>([]);
  const drag = useRef<DragState>(null);
  const lastPos = useRef<THREE.Vector3[]>([]);
  const velocity = useRef<THREE.Vector3[]>([]);

  // Spawned high above the frame with scattered horizontal offsets so they visibly tumble
  // in and settle, rather than just fading into their resting spots.
  const positions: [number, number, number][] = [
    [-0.75, 6.5, 0.6],
    [-0.25, 8.2, -0.6],
    [0.25, 7.1, 0.9],
    [0.75, 9.4, -0.3],
    [0.05, 5.8, 1.3],
  ];

  const registerBody = useCallback((index: number, body: RapierRigidBody | null) => {
    bodyRefs.current[index] = body;
  }, []);

  const handleGrab = useCallback((index: number, worldPoint: THREE.Vector3) => {
    const body = bodyRefs.current[index];
    if (!body) return;
    const t = body.translation();
    const grabOffset = new THREE.Vector3(t.x, t.y, t.z).sub(worldPoint);
    drag.current = { index, grabOffset };
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setBodyType(2, true); // 2 = kinematicPositionBased -- follows the pointer exactly while held
  }, []);

  const handleDragMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    const body = bodyRefs.current[d.index];
    if (!body) return;
    const target = e.point.clone().add(d.grabOffset);
    body.setNextKinematicTranslation({ x: target.x, y: target.y, z: target.z });
  }, []);

  const handleRelease = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const body = bodyRefs.current[d.index];
    const v = velocity.current[d.index];
    drag.current = null;
    if (!body) return;
    body.setBodyType(0, true); // 0 = dynamic -- hand physics back so the throw actually flies
    if (v) {
      body.setLinvel({ x: v.x, y: Math.max(v.y, 0.5), z: v.z }, true);
      body.setAngvel(
        { x: (Math.random() - 0.5) * 8 - v.z * 2, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 8 + v.x * 2 },
        true
      );
    }
  }, []);

  useFrame((_, delta) => {
    // Track per-die velocity from position deltas so releasing a drag throws the die with
    // the same speed/direction the pointer was actually moving, not a fixed flick.
    for (let i = 0; i < bodyRefs.current.length; i++) {
      const body = bodyRefs.current[i];
      if (!body) continue;
      const t = body.translation();
      const cur = new THREE.Vector3(t.x, t.y, t.z);
      if (!lastPos.current[i]) lastPos.current[i] = cur.clone();
      if (!velocity.current[i]) velocity.current[i] = new THREE.Vector3();
      if (drag.current?.index === i && delta > 0) {
        velocity.current[i].copy(cur).sub(lastPos.current[i]).divideScalar(delta);
      }
      lastPos.current[i].copy(cur);
    }
  });

  return (
    <>
      {positions.map((p, i) => (
        <HeroDie key={i} index={i} startPosition={p} registerBody={registerBody} onGrab={handleGrab} />
      ))}
      {/* Invisible plane a drag continues against once a die is grabbed -- R3F only
          raycasts what the pointer is actually over, so dragging past the die's own
          silhouette needs a bigger surface behind it to keep reporting a world position. */}
      <mesh onPointerMove={handleDragMove} onPointerUp={handleRelease} onPointerLeave={handleRelease}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

function Bounds() {
  // Invisible floor + walls the roll-in tumbles onto and the drag-and-throw stays within,
  // so the toy never scatters dice permanently out of frame.
  return (
    <>
      <RigidBody type="fixed" position={[0, -0.55, 0]}>
        <CuboidCollider args={[4, 0.15, 4]} />
      </RigidBody>
      {(
        [
          { pos: [1.5, 1, 0], args: [0.15, 3, 4] },
          { pos: [-1.5, 1, 0], args: [0.15, 3, 4] },
          { pos: [0, 1, 2.2], args: [4, 3, 0.15] },
          { pos: [0, 1, -2.2], args: [4, 3, 0.15] },
        ] satisfies { pos: [number, number, number]; args: [number, number, number] }[]
      ).map(({ pos, args }, i) => (
        <RigidBody key={i} type="fixed" position={pos}>
          <CuboidCollider args={args} />
        </RigidBody>
      ))}
    </>
  );
}

export function DiceHero({ interactive = true }: { interactive?: boolean }) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.5, 10], fov: 32 }}
      dpr={1}
      gl={{ antialias: false, powerPreference: "default", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: true, alpha: true }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-3, 2, 2]} intensity={0.5} color="#fca5a5" />
      <pointLight position={[3, 3, -2]} intensity={0.5} color="#f8fafc" />

      {interactive && (
        <Physics gravity={[0, -9.81, 0]}>
          <Bounds />
          <DiceRig />
        </Physics>
      )}

    </Canvas>
  );
}
