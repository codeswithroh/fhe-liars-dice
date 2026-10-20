"use client";

import { useCallback, useState } from "react";
import { useReadContract } from "wagmi";
import { useCofheClient, useCofheConnection } from "@cofhe/react";
import { FheTypes } from "@cofhe/sdk";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS } from "@/lib/contracts";

/** Reads the caller's own encrypted dice handles and, only on demand (peeking under the
 *  cup), unseals them client-side via a self-issued CoFHE ACP (access control permission). Nothing here ever
 *  reveals another player's hand -- the contract only returns handles for `msg.sender`. */
export function useMyHand(tableId: number) {
  // Deliberately NOT wagmi's `useAccount()`. `client.acp.getOrCreateSelfACP` signs the
  // ACP with whatever account the CoFHE client's own connected walletClient holds -- the
  // `account` argument only labels the ACP's `issuer` field, it doesn't pick the signer.
  // Passing wagmi's address there previously produced an ACP whose *claimed* issuer didn't
  // match its *actual* signer whenever the two libraries' notions of "the active wallet"
  // diverged (this app juggles multiple Privy-registered connectors -- see
  // ActiveWalletSync in app/providers.tsx) -- an unrecoverable signature/issuer mismatch
  // the coprocessor correctly rejects (`acp_denied`), no matter how carefully the
  // account is threaded through afterward. `useCofheConnection().account` is the CoFHE
  // client's own source of truth for which account it's actually going to sign with, so using it
  // for the on-chain read too guarantees both halves agree.
  const { account: address } = useCofheConnection();
  const client = useCofheClient();
  const [values, setValues] = useState<number[] | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handles = useReadContract({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    functionName: "getMyDiceHandles",
    args: [BigInt(tableId)],
    // `getMyDiceHandles` checks `isPlayerAt[tableId][msg.sender]` on-chain -- an eth_call
    // with no explicit `from` resolves msg.sender to the zero address, so without this the
    // read reverted with NotAPlayer() for every real wallet, every single time. This isn't
    // rare-edge-case flakiness; it never worked.
    account: address,
    query: { enabled: Boolean(address) },
  });

  const peek = useCallback(async () => {
    setPeeking(true);
    setError(null);
    try {
      // Always pull a fresh read here rather than trusting `handles.data` -- a losing
      // player's hand shrinks (and every remaining die gets a brand-new ciphertext
      // handle) the moment a new round starts, but wagmi's cached read result for this
      // query doesn't get invalidated by that on its own. Reusing the stale cached array
      // meant peeking after a loss silently re-unsealed last round's now-superseded
      // handles: same length, same values, die count visibly "not decreasing" even
      // though the contract's `diceCount` had already dropped correctly on-chain.
      const fresh = await handles.refetch();
      const currentHandles = fresh.data;
      if (!currentHandles) {
        throw new Error("Dice handles aren't available yet -- try again in a moment.");
      }
      if (!address) {
        throw new Error("Connect your wallet to peek at your hand.");
      }
      await client.acp.getOrCreateSelfACP(undefined, address);
      const results = await Promise.all(
        currentHandles.map((h) => client.decryptForView(h, FheTypes.Uint8).setAccount(address).execute())
      );
      setValues(results.map((r) => Number(r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unseal hand");
    } finally {
      setPeeking(false);
    }
  }, [client, handles, address]);

  const hide = useCallback(() => setValues(null), []);

  return { handles: handles.data, values, peeking, error, peek, hide, refetchHandles: handles.refetch };
}
