"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { useFundWallet } from "@privy-io/react-auth";
import { useMyBalance } from "@/lib/useMyBalance";

const FAUCET_URL = "https://www.alchemy.com/faucets/arbitrum-sepolia";

/** Pops up once per connected address, per tab session, when that wallet can't yet cover
 *  gas on Arbitrum Sepolia -- new Privy embedded wallets start at zero balance, and
 *  without this the first thing a new player sees is an opaque "insufficient funds"
 *  revert from `createTable`/`joinTable` instead of a way to actually fix it. */
export function FundWalletModal() {
  const { address } = useAccount();
  const { value, isLoading, isLowBalance } = useMyBalance(address);
  const { fundWallet } = useFundWallet();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (!address || isLoading || value === undefined || !isLowBalance) return null;
  if (dismissedFor === address) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="panel w-full max-w-sm rounded-2xl border-cyan-500/20 p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
          ⛽
        </div>
        <h2 className="text-lg font-semibold text-slate-50">Your wallet needs testnet ETH</h2>
        <p className="mt-2 text-sm text-slate-400">
          Creating or joining a table costs a small amount of gas on Arbitrum Sepolia.
        </p>

        <button
          onClick={() => fundWallet({ address, options: { chain: arbitrumSepolia, defaultFundingMethod: "manual" } })}
          className="mt-4 block w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          Show my deposit address
        </button>

        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/25"
        >
          Get free testnet ETH from a faucet &rarr;
        </a>

        <button
          onClick={() => setDismissedFor(address)}
          className="mt-3 text-xs text-slate-500 transition hover:text-slate-300"
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}
