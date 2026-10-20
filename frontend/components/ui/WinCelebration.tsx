"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const PARTICLE_COLORS = ["#22d3ee", "#67e8f9", "#f8fafc", "#0891b2"];
const PARTICLE_COUNT = 28;

/** A brief celebratory burst the moment the table actually ends with a winner -- not a
 *  full confetti library (no new dependency), just a handful of small squares thrown out
 *  from center with GSAP and left to fall/fade, tinted to the project's own cyan/white
 *  palette rather than generic rainbow confetti. Fires once per `active` transition to
 *  true; renders nothing otherwise. */
export function WinCelebration({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firedFor = useRef(false);

  useEffect(() => {
    if (!active) {
      firedFor.current = false;
      return;
    }
    if (firedFor.current || !containerRef.current) return;
    firedFor.current = true;

    const container = containerRef.current;
    const particles: HTMLDivElement[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = document.createElement("div");
      const size = 6 + Math.random() * 6;
      p.style.position = "absolute";
      p.style.left = "50%";
      p.style.top = "40%";
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.borderRadius = Math.random() < 0.5 ? "9999px" : "3px";
      p.style.background = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
      p.style.opacity = "0";
      container.appendChild(p);
      particles.push(p);
    }

    particles.forEach((p) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 160;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance * 0.6 - 40;
      gsap.set(p, { x: 0, y: 0, opacity: 1, rotate: 0 });
      gsap.to(p, {
        x,
        y: y + 220,
        rotate: (Math.random() - 0.5) * 540,
        duration: 1.4 + Math.random() * 0.6,
        ease: "power2.out",
      });
      gsap.to(p, { opacity: 0, duration: 0.6, delay: 1.0 + Math.random() * 0.5, ease: "power1.in" });
    });

    const cleanup = setTimeout(() => {
      particles.forEach((p) => p.remove());
    }, 2400);
    return () => clearTimeout(cleanup);
  }, [active]);

  return <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" />;
}
