"use client";

import { Html } from "@react-three/drei";

export function OpponentSeal({
  position,
  label,
  eliminated,
  isTurn,
}: {
  position: [number, number, number];
  label: string;
  eliminated?: boolean;
  isTurn?: boolean;
}) {
  return (
    <group position={position}>
      <Html position={[0, 0.4, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
        <div
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
            eliminated
              ? "bg-slate-800/70 text-slate-400 line-through"
              : isTurn
                ? "bg-cyan-600/80 text-white ring-1 ring-cyan-300"
                : "bg-slate-900/70 text-cyan-200"
          }`}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}
