"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const DiceHero = dynamic(() => import("@/components/scene/DiceHero").then((m) => m.DiceHero), { ssr: false });

function CoBrandBadge() {
  return (
    <div className="flex items-center gap-3 text-slate-400">
      {/* The official Fhenix mark is dark-on-transparent, drawn for a light background --
          a small light plate keeps it exactly as given (no recoloring) while staying
          legible against our dark hero. */}
      <span className="flex h-8 items-center rounded-md bg-white px-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static brand SVG, no benefit from next/image's optimizer */}
        <img src="/brand/fhenix_logo.svg" alt="Fhenix" width={84} height={16} />
      </span>
      <span className="text-lg font-light text-slate-600">&times;</span>
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-300">
        <svg width="18" height="18" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="4" y="4" width="56" height="56" rx="14" fill="#070a0f" stroke="#22d3ee" strokeWidth="4" />
          <circle cx="32" cy="32" r="9" fill="#22d3ee" />
        </svg>
        FHE LIAR&apos;S DICE
      </span>
    </div>
  );
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // The autoPlay attribute alone isn't reliably honored after client-side mounts in
    // every browser -- an explicit play() call is the robust way to start a muted
    // background video. Autoplay-blocked rejections are expected in some contexts and
    // safe to ignore since there's no user-facing control tied to this.
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <div>
      {/* NavBar above this is sticky and occupies real flow height -- ~96px on narrow
          viewports where its links wrap to a second row, ~64px at sm+ where it's one row.
          The hero is sized to whatever's left, not a flat 100dvh, so nav + hero together
          never run past one screen. Fixed height (not min-height) is deliberate: nothing
          in this section, including the dice, may push past one screen. */}
      <section className="relative h-[calc(100dvh-96px)] overflow-hidden sm:h-[calc(100dvh-64px)]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          src="/video/liars_hero.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        {/* Dark scrim so the heading/body text stays legible over the busy video -- kept
            lighter than an earlier pass (opacity-40 on the video) that muted the
            background more than it needed to. Darker still on the left, where the text
            actually sits, tapering off toward the dice on the right. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-[#070a0f]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />

        {/* Split hero: copy owns the left column, the interactive dice own the right --
            the standard "promise on one side, proof on the other" layout instead of both
            stacked in one centered column. On narrow viewports it falls back to a stack
            (grid-rows-[auto_1fr]) so the dice still get real, non-overflowing space rather
            than disappearing or pushing the page past 100vh. */}
        <div className="relative z-10 mx-auto grid h-full max-w-6xl grid-rows-[auto_1fr] items-center gap-2 px-4 py-4 sm:px-6 lg:grid-cols-2 lg:grid-rows-1 lg:gap-8 lg:py-0">
          <div className="flex flex-col items-start gap-4 text-left lg:gap-6">
            <CoBrandBadge />

            <h1 className="max-w-xl text-3xl font-semibold leading-tight text-slate-50 sm:text-5xl lg:text-6xl">
              Nobody sees your <span className="glow-text-cyan text-cyan-400">dice</span>
              <br />
              Everyone sees your <span className="glow-text-warning text-rose-400">lies</span>
            </h1>

            <p className="max-w-md text-base leading-relaxed text-slate-300">
              Roll five dice sealed onchain, bid against the table, then call a bluff. Only the verdict goes public.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/lobby"
                className="rounded-lg bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/30 transition hover:bg-cyan-500"
              >
                Create or join a table
              </Link>
              <Link
                href="/rules"
                className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/25"
              >
                How privacy works
              </Link>
            </div>
          </div>

          <div className="relative h-full min-h-0 w-full">
            <DiceHero />
          </div>
        </div>
      </section>
    </div>
  );
}
