"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";

export type CupState = "down" | "shaking" | "lifted";

type CupGLTF = { nodes: { Plastic_Cup_High_poly?: THREE.Mesh; "Plastic_Cup_High-poly"?: THREE.Mesh } };

useGLTF.preload("/models/cup_dark.glb");
useGLTF.preload("/models/cup_light.glb");

// Measured off the exported model -- its origin sits at the geometry's bounding-box
// center. A real Liar's Dice cup is shown *inverted* the whole time it's covering dice --
// rim down, sealing them against the table -- never sitting rim-up like a drinking cup.
// The group is rotated 180 deg about X to achieve that, and critically the mesh's local Y
// offset has to flip sign to match: rotating 180 deg about X leaves whatever point sits at
// the group's local origin unmoved and swings the opposite end around it, so a *negative*
// offset (putting the rim, not the base, at the pivot) is what lands the rim at table
// height with the base swung up top -- a positive offset here would rotate correctly but
// leave the rim buried below the table and the base floating in the air.
const CUP_HEIGHT = 2.238;
const CUP_RIM_OFFSET = -(CUP_HEIGHT / 2);

// The cup's actual authored materials (read from the .blend, not re-themed): it's an
// opaque two-tone plastic cup -- not glass at all (Transmission Weight was 0 on both).
// Colors are the real Principled BSDF base colors, linear-to-sRGB converted.
const DARK_PLASTIC = "#4c312c";
const LIGHT_PLASTIC = "#d5dad6";

export function Cup({ state }: { state: CupState }) {
  const { nodes: darkNodes } = useGLTF("/models/cup_dark.glb") as unknown as CupGLTF;
  const { nodes: lightNodes } = useGLTF("/models/cup_light.glb") as unknown as CupGLTF;
  const darkMesh = darkNodes["Plastic_Cup_High-poly"] ?? darkNodes.Plastic_Cup_High_poly;
  const lightMesh = lightNodes["Plastic_Cup_High-poly"] ?? lightNodes.Plastic_Cup_High_poly;
  const group = useRef<THREE.Group>(null);
  const lastState = useRef<CupState | null>(null);

  useFrame(() => {
    if (!group.current) return;
    if (state !== lastState.current) {
      lastState.current = state;
      gsap.killTweensOf(group.current.position);
      gsap.killTweensOf(group.current.rotation);

      if (state === "down") {
        // Low, not zero -- avoids z-fighting with the table plane -- but a die sitting
        // near the edge of its containment radius could otherwise be visible peeking
        // through the gap between the table and the rim's bottom edge from a low camera
        // angle if this sits much higher than that.
        gsap.to(group.current.position, { y: 0.008, x: 0, z: 0, duration: 0.55, ease: "back.out(1.4)" });
        gsap.to(group.current.rotation, { z: 0, duration: 0.4 });
      } else if (state === "shaking") {
        gsap.to(group.current.position, { y: 1.15, duration: 0.3, ease: "power2.out" });
        const tl = gsap.timeline({ repeat: 5 });
        tl.to(group.current.position, { x: -0.35, duration: 0.09, ease: "sine.inOut" })
          .to(group.current.position, { x: 0.35, duration: 0.09, ease: "sine.inOut" })
          .to(group.current.position, { x: 0, duration: 0.09, ease: "sine.inOut" });
        const tl2 = gsap.timeline({ repeat: 5 });
        tl2.to(group.current.rotation, { z: 0.35, duration: 0.09, ease: "sine.inOut" })
          .to(group.current.rotation, { z: -0.35, duration: 0.09, ease: "sine.inOut" })
          .to(group.current.rotation, { z: 0, duration: 0.09, ease: "sine.inOut" });
      } else if (state === "lifted") {
        // Lift the (still inverted) cup straight up and slide it aside so it clears the
        // dice Scene.tsx has moved to REVEAL_SLOTS -- this is "pick the cup up off the
        // dice," not "set it back down the right way up," so rotation stays untouched.
        gsap.to(group.current.position, { y: 1.7, x: 1.7, z: -0.3, duration: 0.9, ease: "power2.inOut" });
        gsap.to(group.current.rotation, { z: 0, duration: 0.9, ease: "power2.inOut" });
      }
    }
  });

  return (
    <group ref={group} position={[0, 0.008, 0]} rotation={[Math.PI, 0, 0]}>
      {/* Real plastic-cup mesh (sourced from the .blend asset), rendered as the opaque
          two-tone plastic it actually is -- the earlier glass/transmission look didn't
          match the source material at all. */}
      {darkMesh && (
        <mesh geometry={darkMesh.geometry} position={[0, CUP_RIM_OFFSET, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={DARK_PLASTIC} roughness={0.5} metalness={0} />
        </mesh>
      )}
      {lightMesh && (
        <mesh geometry={lightMesh.geometry} position={[0, CUP_RIM_OFFSET, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={LIGHT_PLASTIC} roughness={0.5} metalness={0} />
        </mesh>
      )}
    </group>
  );
}
