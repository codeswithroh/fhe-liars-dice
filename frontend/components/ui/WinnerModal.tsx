"use client";

import { Modal } from "./Modal";

/** The one modal every game ends on -- deliberately louder/bigger than a round result
 *  (larger title, trophy glyph) so it reads as final rather than another status popup in
 *  the same stream. */
export function WinnerModal({
  open,
  onOpenChange,
  winnerLabel,
  isMe = false,
  pointsNote,
  footnote,
  primaryLabel,
  onPrimary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winnerLabel: string;
  isMe?: boolean;
  pointsNote?: string;
  /** A secondary, visually de-emphasized line below the main result -- for context that
   *  matters but isn't the headline (e.g. practice mode explicitly NOT awarding points,
   *  so a player can't mistake a bot-opponent win for something that counts on-chain). */
  footnote?: string;
  primaryLabel: string;
  onPrimary: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      tone="good"
      title={
        <span className="flex items-center gap-2 text-xl">
          <span aria-hidden>🏆</span>
          {isMe ? "You won!" : "Game over"}
        </span>
      }
      footer={
        <button
          onClick={onPrimary}
          className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          {primaryLabel}
        </button>
      }
    >
      <p className="text-base">
        <span className="font-semibold text-cyan-300">{winnerLabel}</span> took the table
        {pointsNote ? <span className="text-slate-400"> — {pointsNote}</span> : "."}
      </p>
      {footnote && <p className="mt-2 text-xs text-slate-500">{footnote}</p>}
    </Modal>
  );
}
