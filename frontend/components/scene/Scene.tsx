"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Table } from "./Table";
import { Cup, CupState } from "./Cup";
import { Die } from "./Die";
import { OpponentSeal } from "./OpponentSeal";
import { VerdictGlow } from "./VerdictGlow";

export interface OpponentInfo {
  label: string;
  eliminated?: boolean;
  isTurn?: boolean;
}

export interface SceneProps {
  cupState: CupState;
  myDice: number[];
  revealed: boolean;
  settleSignal: number;
  opponents: OpponentInfo[];
  verdictActive?: boolean;
  verdictGood?: boolean | null;
  interactive?: boolean;
}

/** Where a revealed die animates into: a clean row pulled forward of the cup, toward the
 *  camera, so peeking at your hand never means squinting at dice buried under (or
 *  occluded by) the cup. */
const REVEAL_SLOTS: [number, number, number][] = [-1.2, -0.6, 0, 0.6, 1.2].map((x) => [x, 0.25, 1.1]);

/** How long the cup visibly rattles above the table before coming back down to seal the
 *  freshly-rolled dice. Purely cosmetic, driven by `settleSignal` changing (a new round). */
const SHAKE_DURATION_MS = 1500;

export function Scene({
  cupState,
  myDice,
  revealed,
  settleSignal,
  opponents,
  verdictActive = false,
  verdictGood = null,
  interactive = true,
}: SceneProps) {
  const opponentPositions = useMemo<[number, number, number][]>(() => {
    const n = Math.max(opponents.length, 1);
    return opponents.map((_, i) => {
      const angle = (i / n) * Math.PI * 2 + Math.PI / n;
      return [Math.sin(angle) * 3.1, 0.55, Math.cos(angle) * 3.1];
    });
  }, [opponents]);

  // A fresh roll (settleSignal changing) plays a shake beat before settling to whatever
  // cupState the caller actually wants (down while sealed, lifted while peeking).
  const [autoShaking, setAutoShaking] = useState(false);
  const prevSignal = useRef(settleSignal);
  useEffect(() => {
    if (settleSignal === prevSignal.current) return;
    prevSignal.current = settleSignal;
    setAutoShaking(true);
    const t = setTimeout(() => setAutoShaking(false), SHAKE_DURATION_MS);
    return () => clearTimeout(t);
  }, [settleSignal]);

  const effectiveCupState: CupState = autoShaking ? "shaking" : cupState;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 4.6, 7.4], fov: 38 }}
      dpr={1}
      gl={{ antialias: false, powerPreference: "default", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 10, 22]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 7, 3]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-3, 2.5, -3]} intensity={0.5} color="#0891b2" />
      <pointLight position={[3, 3.5, 3]} intensity={0.6} color="#f8fafc" />
      {/* Extra local highlights the glass cup can catch -- no remote HDRI (Environment)
          since that fetch is unreliable in constrained/offline browser environments and
          previously broke rendering entirely there. */}
      <pointLight position={[0, 2.2, 2.5]} intensity={0.8} color="#e6fbff" distance={6} />
      <pointLight position={[0, 1.4, -2]} intensity={0.4} color="#22d3ee" distance={5} />

      <Physics gravity={[0, -9.81, 0]}>
        <Table />
        <group position={[0, 0.3, 0.6]}>
          <Cup state={effectiveCupState} />
          {/* Persistent side tag, like a name badge next to a hand of cards, so it's never
              ambiguous which dice on the table are yours vs an opponent's sealed hand. */}
          <Html position={[-1.85, 0.95, 0.3]} center distanceFactor={8} zIndexRange={[10, 0]}>
            <div className="whitespace-nowrap rounded-full bg-cyan-600/85 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-cyan-300">
              Your hand
            </div>
          </Html>
          {/* Dice only exist in the scene once their value is known and the cup has been
              lifted -- while sealed there's simply nothing under the cup to render, which
              is what actually guarantees nothing can ever be seen poking out from under it
              (rather than trying to perfectly contain/occlude a die that IS there). */}
          {revealed &&
            myDice.map((value, i) => (
              <Die key={i} revealSlot={REVEAL_SLOTS[i % REVEAL_SLOTS.length]} value={value} />
            ))}
        </group>
      </Physics>

      {opponents.map((o, i) => (
        <OpponentSeal key={o.label + i} position={opponentPositions[i]} label={o.label} eliminated={o.eliminated} isTurn={o.isTurn} />
      ))}

      <VerdictGlow active={verdictActive} good={verdictGood ?? null} />

      <ContactShadows position={[0, -0.001, 0]} opacity={0.55} scale={12} blur={2.2} far={2.5} />

      <OrbitControls
        enabled={interactive}
        enablePan={false}
        enableZoom={interactive}
        minDistance={5}
        maxDistance={10.5}
        minPolarAngle={Math.PI / 5}
        // Capped short of true horizontal -- past that the camera is grazing the table at
        // eye level, an unrealistic vantage point for looking at a tabletop.
        maxPolarAngle={Math.PI / 2.6}
        target={[0, 0.5, 0]}
      />
    </Canvas>
  );
}
