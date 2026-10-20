"use client";

import { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

/** Shared modal shell for every status popup in the app (round results, elimination,
 *  winner) -- one library, one look, so a player learns the pattern once ("dark card,
 *  cyan-glow title, click outside or the button to dismiss") instead of every status
 *  getting its own bespoke overlay. Built on Radix's Dialog primitive for the
 *  accessibility plumbing (focus trap, Escape-to-close, aria roles) that's easy to get
 *  subtly wrong hand-rolling it. */
export function Modal({
  open,
  onOpenChange,
  title,
  tone = "neutral",
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  tone?: "neutral" | "good" | "bad";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleGlow =
    tone === "good" ? "glow-text-cyan text-cyan-300" : tone === "bad" ? "glow-text-warning text-rose-300" : "text-slate-100";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fadeIn_0.15s_ease-out]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-2xl shadow-black/60 outline-none data-[state=open]:animate-[popIn_0.18s_ease-out]"
        >
          <Dialog.Title className={`text-lg font-semibold ${titleGlow}`}>{title}</Dialog.Title>
          <div className="mt-3 text-sm text-slate-300">{children}</div>
          {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
