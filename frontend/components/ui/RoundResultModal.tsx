"use client";

import { Modal } from "./Modal";
import { DiceHandRow } from "./DiceFace";

export interface RevealedHand {
  label: string;
  dice: number[];
  isLoser?: boolean;
}

// "You" (practice mode's label for the human player) takes a plural verb form --
// "You lose", not "You loses" -- unlike every other label here (bot names, short
// addresses), which are all grammatically third-person singular.
function isSecondPerson(label: string): boolean {
  return label.trim().toLowerCase() === "you";
}

/** Fires once per resolved challenge -- "was the bid good or a lie, who paid for it, what
 *  did every hand actually hold" -- the moment of truth a round of bluffing builds up to.
 *  Surfacing it as a modal (rather than the easy-to-miss inline panel this replaced) means
 *  a player can't accidentally blow past the one moment that actually matters. */
export function RoundResultModal({
  open,
  onOpenChange,
  bidWasGood,
  loserLabel,
  eliminated,
  reveal,
  continueLabel,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidWasGood: boolean;
  loserLabel: string;
  eliminated: boolean;
  reveal: RevealedHand[];
  continueLabel: string;
  onContinue: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      tone={bidWasGood ? "good" : "bad"}
      title={bidWasGood ? "The bid was good" : "It was a lie"}
      footer={
        <button
          onClick={onContinue}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          {continueLabel}
        </button>
      }
    >
      <p>
        <span className="font-semibold text-slate-100">{loserLabel}</span>{" "}
        {isSecondPerson(loserLabel)
          ? eliminated
            ? "are out of dice and eliminated."
            : "lose a die."
          : eliminated
            ? "is out of dice and eliminated."
            : "loses a die."}
      </p>

      {reveal.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {reveal.map((hand) => (
            <div key={hand.label} className="flex flex-col gap-1.5">
              <span className={`text-xs font-medium ${hand.isLoser ? "text-rose-400" : "text-slate-500"}`}>
                {hand.label}
              </span>
              <DiceHandRow values={hand.dice} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
