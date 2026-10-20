"use client";

import { useReadContract } from "wagmi";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS } from "@/lib/contracts";

/** Games won by `address` -- 1 point per table won, including points carried over from the
 *  previous deployment. */
export function usePoints(address?: `0x${string}`) {
  const points = useReadContract({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    functionName: "getPoints",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  return {
    points: points.data ?? BigInt(0),
    isLoading: points.isLoading,
    refetch: points.refetch,
  };
}

export interface LeaderboardRow {
  player: `0x${string}`;
  points: bigint;
}

/** Top scorers, read from the contract's bounded, pre-sorted on-chain leaderboard.
 *  (The old `getAllPlayerPoints` returned every player who ever joined and sorted client-side;
 *  at 100k+ players that call timed out and the leaderboard never loaded.) */
export function useLeaderboard() {
  const leaderboard = useReadContract({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    functionName: "getLeaderboard",
    query: { refetchInterval: 5000 },
  });

  const [players, pointsList] = leaderboard.data ?? [[], []];
  const rows: LeaderboardRow[] = players.map((player, i) => ({ player, points: pointsList[i] ?? BigInt(0) }));

  return {
    rows,
    isLoading: leaderboard.isLoading,
    isError: leaderboard.isError,
    refetch: leaderboard.refetch,
  };
}

/** The connected player's leaderboard position (1-based; 0 = outside the top list). */
export function useLeaderboardRank(address?: `0x${string}`) {
  const rank = useReadContract({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    functionName: "getLeaderboardRank",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  return { rank: rank.data !== undefined ? Number(rank.data) : undefined, isLoading: rank.isLoading };
}
