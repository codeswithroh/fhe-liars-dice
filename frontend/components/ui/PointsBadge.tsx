"use client";

import { useAccount } from "wagmi";
import { usePoints } from "@/lib/usePoints";

export function PointsBadge() {
  const { address } = useAccount();
  const { points } = usePoints(address);

  if (!address) return null;

  return (
    <span
      className="glow-text-cyan rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-300"
      title="Games won — 1 credit for every table you finish as the last player standing"
    >
      {points.toString()} credit{points === BigInt(1) ? "" : "s"}
    </span>
  );
}
