"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  // Address comes from wagmi, not Privy's user object directly -- @privy-io/wagmi keeps
  // this in sync with whichever wallet Privy currently has active (embedded, external,
  // or one linked via email/social login), so the rest of the app's wagmi hooks
  // (useSendTx, useTableState, etc.) don't need to know Privy is involved at all.
  const { address } = useAccount();
  // Privy's own deposit-address/QR flow -- more trustworthy and better tested than a
  // hand-rolled "here's the address, go paste it" box, and it already knows how to render
  // a QR code, validate the chain, and avoid clipboard/overflow bugs.
  const { fundWallet } = useFundWallet();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!ready) {
    return (
      <button disabled className="rounded-lg border border-white/10 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-500">
        Loading…
      </button>
    );
  }

  if (authenticated && address) {
    return (
      <div ref={ref} className="relative inline-block">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-lg border border-white/10 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/25"
        >
          {short(address)}
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-white/10 bg-[#0b0f19] p-4 text-left shadow-xl shadow-black/50">
            <p className="text-xs font-semibold text-slate-200">Your wallet</p>
            <p className="mt-1.5 break-all font-mono text-[11px] leading-snug text-slate-400">{address}</p>
            <button
              onClick={() => {
                setOpen(false);
                fundWallet({ address, options: { chain: arbitrumSepolia, defaultFundingMethod: "manual" } });
              }}
              className="mt-3 w-full rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500"
            >
              Receive Arbitrum Sepolia ETH
            </button>
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="mt-2 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => login()}
      className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
    >
      Connect Wallet
    </button>
  );
}
