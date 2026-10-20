"use client";

import { useCallback } from "react";
import { usePublicClient } from "wagmi";
import { useCofheClient } from "@cofhe/react";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS } from "@/lib/contracts";
import { useSendTx } from "@/lib/useSendTx";

/** CoFHE's current decrypt flow has no automatic on-chain relayer: a value only becomes
 *  decryptable on-chain after the contract marks it (`FHE.allowPublic`), and someone must
 *  then fetch the plaintext + Threshold Network signature off-chain via `decryptForTx` and
 *  submit both back on-chain. These two hooks do that fetch-then-submit for the game's two
 *  decrypt points (the challenge verdict, and each revealed hand) so the "Reveal verdict" /
 *  "Reveal hands" buttons do the whole round trip in one click. */

export function useFinalizeChallenge() {
  const { sendTx, isPending } = useSendTx();
  const publicClient = usePublicClient();
  const client = useCofheClient();

  const finalizeChallenge = useCallback(
    async (tableId: number) => {
      if (!publicClient) throw new Error("Wallet not connected to a network");
      const ctHash = await publicClient.readContract({
        address: FHE_LIARS_DICE_ADDRESS,
        abi: fheLiarsDiceAbi,
        functionName: "getPendingVerdictHandle",
        args: [BigInt(tableId)],
      });
      const result = await client.decryptForTx(BigInt(ctHash as string)).withoutACP().execute();
      return sendTx({
        address: FHE_LIARS_DICE_ADDRESS,
        abi: fheLiarsDiceAbi,
        functionName: "finalizeChallenge",
        args: [BigInt(tableId), Boolean(result.decryptedValue), result.signature],
      });
    },
    [publicClient, client, sendTx]
  );

  return { finalizeChallenge, isPending };
}

export function useFinalizeReveal() {
  const { sendTx, isPending } = useSendTx();
  const publicClient = usePublicClient();
  const client = useCofheClient();

  const finalizeReveal = useCallback(
    async (tableId: number) => {
      if (!publicClient) throw new Error("Wallet not connected to a network");
      const [, handles] = await publicClient.readContract({
        address: FHE_LIARS_DICE_ADDRESS,
        abi: fheLiarsDiceAbi,
        functionName: "getPendingRevealHandles",
        args: [BigInt(tableId)],
      });

      const flatHandles = (handles as readonly (readonly `0x${string}`[])[]).flatMap((h) => h);
      const decrypted = await Promise.all(
        flatHandles.map((h) => client.decryptForTx(BigInt(h)).withoutACP().execute())
      );

      return sendTx({
        address: FHE_LIARS_DICE_ADDRESS,
        abi: fheLiarsDiceAbi,
        functionName: "finalizeReveal",
        args: [
          BigInt(tableId),
          decrypted.map((d) => Number(d.decryptedValue)),
          decrypted.map((d) => d.signature),
        ],
      });
    },
    [publicClient, client, sendTx]
  );

  return { finalizeReveal, isPending };
}
