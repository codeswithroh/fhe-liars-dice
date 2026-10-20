"use client";

import { useReadContract } from "wagmi";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS } from "@/lib/contracts";

export function useTableState(tableId: number) {
  const table = useReadContract({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    functionName: "getTable",
    args: [BigInt(tableId)],
    query: { refetchInterval: 3000 },
  });

  const bidHistory = useReadContract({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    functionName: "getBidHistory",
    args: [BigInt(tableId)],
    query: { refetchInterval: 3000 },
  });

  const [
    host,
    maxPlayers,
    phase,
    roundNumber,
    players,
    eliminatedFlags,
    turnIdx,
    currentBid,
    hasBid,
    winner,
  ] = table.data ?? [];

  return {
    isLoading: table.isLoading,
    refetch: () => {
      table.refetch();
      bidHistory.refetch();
    },
    host,
    maxPlayers,
    phase,
    roundNumber,
    players: players ?? [],
    eliminatedFlags: eliminatedFlags ?? [],
    turnIdx,
    currentBid,
    hasBid,
    winner,
    bidHistory: bidHistory.data ?? [],
  };
}
