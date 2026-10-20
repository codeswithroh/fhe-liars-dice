"use client";

import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useReadContract, useReadContracts } from "wagmi";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS, GamePhase } from "@/lib/contracts";

export interface TableSummary {
  id: number;
  host: `0x${string}`;
  maxPlayers: number;
  phase: number;
  playerCount: number;
  players: `0x${string}`[];
}

export const TABLES_PAGE_SIZE = 12;

// Most ids in any given range are already full or finished, so slicing raw ids 1:1 with
// displayed cards made the "Open tables" count swing unpredictably page to page (a
// window of 12 raw ids might hold 12 open tables, or 2). Scan a wider window per page in
// one multicall and only display the first `pageSize` open ones found in it -- still a
// single bounded batch call (no perf regression), but the displayed count stays
// consistent instead of jumping around.
const SCAN_MULTIPLIER = 6;

/** Lists tables by scanning `getTable(id)`, one window at a time (newest id first)
 *  instead of every table ever created -- multicalling `getTable` for thousands of ids
 *  on every 5s poll was the lobby's main slowdown. No separate indexer service -- fine
 *  at casual-MVP scale, see README scope notes. A window can still legitimately surface
 *  fewer than `pageSize` open tables if most of it has filled up or ended, but scanning
 *  SCAN_MULTIPLIER times as many ids as we display makes that the exception rather than
 *  the norm. */
export function useTables(page = 0, pageSize = TABLES_PAGE_SIZE) {
  const { data: nextTableId, isLoading: countLoading } = useReadContract({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    functionName: "nextTableId",
    query: { refetchInterval: 6000 },
  });

  const count = nextTableId ? Number(nextTableId) : 0;
  const scanSize = pageSize * SCAN_MULTIPLIER;
  const totalPages = Math.max(1, Math.ceil(count / scanSize));

  const ids = useMemo(() => {
    const highestId = count - 1 - page * scanSize;
    if (highestId < 0) return [];
    const lowestId = Math.max(0, highestId - scanSize + 1);
    const arr: number[] = [];
    for (let id = highestId; id >= lowestId; id--) arr.push(id);
    return arr;
  }, [count, page, scanSize]);

  const { data, isLoading: tablesLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: FHE_LIARS_DICE_ADDRESS,
      abi: fheLiarsDiceAbi,
      functionName: "getTable" as const,
      args: [BigInt(id)] as const,
    })),
    // Keep showing the previous window's cards while the next one loads (page changes,
    // or the 5s poll refreshing table state) instead of flashing back to skeletons --
    // that flash-then-resettle is what read as "abrupt" in the open tables grid.
    query: { enabled: ids.length > 0, refetchInterval: 5000, placeholderData: keepPreviousData },
  });

  const tables: TableSummary[] = useMemo(() => {
    if (!data) return [];
    return data
      .map((r, i) => {
        if (r.status !== "success") return null;
        const [host, maxPlayers, phase, , players] = r.result as unknown as [
          `0x${string}`,
          number,
          number,
          bigint,
          `0x${string}`[],
          boolean[],
          number,
          unknown,
          boolean,
          `0x${string}`,
        ];
        return { id: ids[i], host, maxPlayers, phase, playerCount: players.length, players };
      })
      .filter((t): t is TableSummary => t !== null);
  }, [data, ids]);

  const openTables = tables.filter((t) => t.phase === GamePhase.Lobby).slice(0, pageSize);

  return {
    tables,
    openTables,
    isLoading: countLoading || (ids.length > 0 && !data && tablesLoading),
    page,
    pageSize,
    totalPages,
    totalCount: count,
  };
}
