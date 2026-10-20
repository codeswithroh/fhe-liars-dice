import type { PracticeBid, PracticePlayer } from "./practiceStore";

/** A bot only ever looks at its own dice + the public bid, never at other hands -- the
 *  same information a real player has. Estimates the true total from its own exact count
 *  plus the statistical expectation for everyone else's hidden dice. Uses each opponent's
 *  actual remaining dice count (visible from the public "N dice left" state, same as bid
 *  history) rather than assuming everyone still has a full hand of 5 -- otherwise bots
 *  get systematically overconfident in the late game once players start losing dice. */
function estimateTotal(self: PracticePlayer, otherDiceTotal: number, face: number): number {
  const own = self.dice.filter((d) => (face === 1 ? d === 1 : d === face || d === 1)).length;
  const perDieChance = face === 1 ? 1 / 6 : 2 / 6;
  const expectedFromOthers = otherDiceTotal * perDieChance;
  return own + expectedFromOthers;
}

export interface BotDecision {
  action: "bid" | "challenge";
  quantity?: number;
  face?: number;
}

export function decideBotMove(
  self: PracticePlayer,
  activePlayers: PracticePlayer[],
  currentBid: PracticeBid | null
): BotDecision {
  const otherDiceTotal = activePlayers.filter((p) => p.id !== self.id).reduce((sum, p) => sum + p.diceCount, 0);

  if (!currentBid) {
    // Opening bid: pick the bot's own most common face and bid conservatively on it.
    const counts = new Map<number, number>();
    for (const d of self.dice) counts.set(d, (counts.get(d) ?? 0) + 1);
    let bestFace = 2;
    let bestCount = -1;
    for (const [face, count] of counts) {
      const effective = face === 1 ? count * 2 : count + (counts.get(1) ?? 0);
      if (effective > bestCount) {
        bestCount = effective;
        bestFace = face;
      }
    }
    return { action: "bid", quantity: Math.max(1, Math.min(2, bestCount)), face: bestFace };
  }

  const estimate = estimateTotal(self, otherDiceTotal, currentBid.face);
  const margin = estimate - currentBid.quantity;

  // The higher the bid overshoots our estimate, the more likely we call it a lie. Some
  // randomness so bots aren't perfectly predictable (and occasionally bluff-call wrong).
  const bluffSuspicion = -margin / Math.max(1, estimate);
  if (bluffSuspicion > 0.18 + Math.random() * 0.15) {
    return { action: "challenge" };
  }

  // Otherwise escalate: prefer raising the face at the same quantity if there's room,
  // else bump the quantity by one on our best-estimated face.
  if (currentBid.face < 6 && Math.random() < 0.5) {
    return { action: "bid", quantity: currentBid.quantity, face: currentBid.face + 1 };
  }
  return { action: "bid", quantity: currentBid.quantity + 1, face: currentBid.face };
}
