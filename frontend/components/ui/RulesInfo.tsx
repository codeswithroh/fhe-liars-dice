"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Most players jump straight into a table without reading /rules first. This gives them
 *  the condensed version right where they need it -- click-to-toggle rather than
 *  hover-only so it works on touch, closes on an outside click or Escape. */
export function RulesInfo() {
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

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="How to play"
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[11px] font-semibold text-slate-400 transition hover:border-cyan-400/50 hover:text-cyan-300"
      >
        i
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-30 w-72 rounded-xl border border-white/10 bg-[#0b0f19] p-4 text-left shadow-xl shadow-black/50">
          <p className="text-xs font-semibold text-slate-200">How to play, fast</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-400">
            <li>Everyone rolls 5 hidden dice. Only you can see your own.</li>
            <li>
              Take turns bidding how many dice of a face show <em>across the whole table</em> &mdash; e.g. &quot;six
              4s&quot;.
            </li>
            <li>Each new bid must raise the quantity, or match it with a higher face.</li>
            <li>
              Face <strong className="text-slate-200">1 is wild</strong> and counts toward any bid.
            </li>
            <li>Instead of bidding, challenge the last bid to call it a bluff.</li>
            <li>Wrong guess, wrong bluff &mdash; whoever&apos;s off gets eliminated.</li>
          </ul>
          <Link
            href="/rules"
            target="_blank"
            className="mt-3 inline-block text-xs font-semibold text-cyan-300 hover:underline"
          >
            Full rules &amp; privacy details &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
