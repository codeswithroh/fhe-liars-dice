"use client";

import Link from "next/link";
import { ConnectButton } from "./ConnectButton";
import { PointsBadge } from "./PointsBadge";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/lobby", label: "Lobby" },
  { href: "/practice", label: "Practice" },
  { href: "/rules", label: "Rules" },
];

export function NavBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-[#05070d]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-100">
          <svg width="20" height="20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect x="4" y="4" width="56" height="56" rx="14" fill="#070a0f" stroke="#22d3ee" strokeWidth="4" />
            <circle cx="32" cy="32" r="9" fill="#22d3ee" />
          </svg>
          FHE LIAR&apos;S DICE
        </Link>
        <nav className="order-3 flex w-full gap-5 text-sm text-slate-400 sm:order-none sm:w-auto sm:gap-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-slate-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <PointsBadge />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
