"use client";

import { useBalance } from "wagmi";

/** Rough floor for "can this wallet actually pay for a tx" -- Arbitrum Sepolia gas is
 *  cheap, but leave headroom above a single average tx cost so the banner clears before
 *  the user is one gas spike away from a failed send. */
export const MIN_GAS_BALANCE = BigInt("200000000000000"); // 0.0002 ETH

export function useMyBalance(address?: `0x${string}`) {
  const balance = useBalance({
    address,
    query: { enabled: !!address, refetchInterval: 10000 },
  });

  return {
    value: balance.data?.value,
    isLoading: balance.isLoading,
    isLowBalance: balance.data !== undefined && balance.data.value < MIN_GAS_BALANCE,
    refetch: balance.refetch,
  };
}
