"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/** A transient toast that fires the moment a player's dice count drops -- losing a
 *  challenge should *feel* like something happened, not just quietly shrink a hand of
 *  icons the player has to notice on their own. Tracks the previous count itself so
 *  callers just pass the live number and don't need to compute a diff. */
export function DieLossFlash({ diceCount }: { diceCount: number | null }) {
  const prevCount = useRef<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [lost, setLost] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (diceCount === null) return;
    if (prevCount.current !== null && diceCount < prevCount.current) {
      setLost(prevCount.current - diceCount);
      setFlashKey((k) => k + 1);
    }
    prevCount.current = diceCount;
  }, [diceCount]);

  useEffect(() => {
    if (flashKey === 0 || !ref.current) return;
    const el = ref.current;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { opacity: 0, y: 8, scale: 0.9 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.35,
        ease: "back.out(2)",
        onComplete: () => {
          gsap.to(el, { opacity: 0, y: -6, duration: 0.5, delay: 1.2, ease: "power1.in" });
        },
      }
    );
  }, [flashKey]);

  if (flashKey === 0) return null;

  return (
    <div
      key={flashKey}
      ref={ref}
      className="pointer-events-none rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300"
    >
      -{lost} die{lost === 1 ? "" : "s"} lost
    </div>
  );
}
