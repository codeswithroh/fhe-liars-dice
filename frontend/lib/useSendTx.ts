"use client";

import { useCallback } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import type { Abi, ContractFunctionArgs, ContractFunctionName } from "viem";

/** Buffer applied on top of the freshly-fetched fee estimate. Arbitrum Sepolia's base fee
 *  can drift a few percent between when a wallet estimates a fee and when the signed
 *  transaction actually lands in a block, which throws "max fee per gas less than block
 *  base fee" if the wallet's own (often slightly stale) estimate is used as-is. Fetching a
 *  fresh estimate right before sending and padding it removes that race in practice. */
const FEE_BUFFER_NUM = BigInt(150);
const FEE_BUFFER_DEN = BigInt(100);

/** Wraps wagmi's writeContractAsync so every write in the app pads gas fees the same way,
 *  instead of trusting whatever the connected wallet happens to suggest at signing time. */
export function useSendTx() {
  const { writeContractAsync, ...rest } = useWriteContract();
  const publicClient = usePublicClient();

  const sendTx = useCallback(
    async <
      const abi extends Abi | readonly unknown[],
      functionName extends ContractFunctionName<abi, "nonpayable" | "payable">,
      args extends ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>,
    >(params: {
      address: `0x${string}`;
      abi: abi;
      functionName: functionName;
      args: args;
    }) => {
      let feeOverrides: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } = {};
      try {
        if (publicClient) {
          const fees = await publicClient.estimateFeesPerGas();
          if (fees.maxFeePerGas && fees.maxPriorityFeePerGas) {
            feeOverrides = {
              maxFeePerGas: (fees.maxFeePerGas * FEE_BUFFER_NUM) / FEE_BUFFER_DEN,
              maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * FEE_BUFFER_NUM) / FEE_BUFFER_DEN,
            };
          }
        }
      } catch {
        // Fall back to letting the wallet pick fees if the fresh estimate itself fails --
        // better to attempt the original (slightly race-prone) path than to block sending.
      }

      return writeContractAsync({
        ...params,
        ...feeOverrides,
      } as Parameters<typeof writeContractAsync>[0]);
    },
    [writeContractAsync, publicClient]
  );

  return { sendTx, ...rest };
}
