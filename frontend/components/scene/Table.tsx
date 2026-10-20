"use client";

import { RigidBody } from "@react-three/rapier";

export function Table() {
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[10, 1, 10]} />
          <meshStandardMaterial color="#0b0f19" roughness={0.85} metalness={0.05} />
        </mesh>
      </RigidBody>
      <mesh receiveShadow position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 64]} />
        <meshStandardMaterial color="#0e1729" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.55, 3.65, 64]} />
        <meshStandardMaterial color="#0891b2" emissive="#0891b2" emissiveIntensity={0.6} />
      </mesh>
      {/* invisible walls so dice stay on the table */}
      {[0, 90, 180, 270].map((deg) => (
        <RigidBody key={deg} type="fixed" colliders="cuboid">
          <mesh
            position={[Math.sin((deg * Math.PI) / 180) * 3.4, 0.5, Math.cos((deg * Math.PI) / 180) * 3.4]}
            rotation={[0, (deg * Math.PI) / 180, 0]}
            visible={false}
          >
            <boxGeometry args={[7, 1.5, 0.2]} />
            <meshBasicMaterial />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
