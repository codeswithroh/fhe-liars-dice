import { create } from "zustand";

/** Fully local, offline game against simple bots -- no wallet, no chain, no encryption.
 *  Lets anyone feel the actual Liar's Dice loop (shake, peek, bid, challenge, reveal)
 *  without needing testnet ETH or a wallet extension. The real privacy guarantees only
 *  exist on the deployed contract; this mode is clearly labeled as practice, not that. */

export interface PracticePlayer {
  id: string;
  name: string;
  isBot: boolean;
  dice: number[];
  /** How many dice this player has left -- starts at 5, loses one per lost challenge.
   *  Real Liar's Dice: a bad call doesn't knock you out, it costs you one die. You're only
   *  out once you have none left, and the table plays on with whoever's still holding
   *  dice until a single player remains. */
  diceCount: number;
  eliminated: boolean;
}

export interface PracticeBid {
  quantity: number;
  face: number;
  bidderId: string;
}

export interface PracticeLogEntry {
  id: string;
  text: string;
  tone: "neutral" | "good" | "bad";
}

type Phase = "idle" | "playing" | "revealed" | "ended";

interface PracticeState {
  players: PracticePlayer[];
  currentBid: PracticeBid | null;
  turnIdx: number;
  phase: Phase;
  roundNumber: number;
  lastVerdict: { bidWasGood: boolean; loserId: string } | null;
  lastReveal: PracticePlayer[] | null;
  winnerId: string | null;
  log: PracticeLogEntry[];

  start: (numBots: number) => void;
  placeBid: (quantity: number, face: number) => void;
  challenge: () => void;
  continueAfterReveal: () => void;
}

const HUMAN_ID = "you";

function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

function countMatches(players: PracticePlayer[], face: number): number {
  let total = 0;
  for (const p of players) {
    if (p.eliminated) continue;
    for (const d of p.dice) {
      if (face === 1 ? d === 1 : d === face || d === 1) total += 1;
    }
  }
  return total;
}

function activePlayers(players: PracticePlayer[]): PracticePlayer[] {
  return players.filter((p) => !p.eliminated);
}

function pushLog(log: PracticeLogEntry[], text: string, tone: PracticeLogEntry["tone"] = "neutral") {
  return [...log, { id: `${Date.now()}-${Math.random()}`, text, tone }];
}

function nextTurn(players: PracticePlayer[], fromIdx: number): number {
  const n = players.length;
  let idx = fromIdx;
  for (let k = 0; k < n; k++) {
    idx = (idx + 1) % n;
    if (!players[idx].eliminated) return idx;
  }
  return fromIdx;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  players: [],
  currentBid: null,
  turnIdx: 0,
  phase: "idle",
  roundNumber: 0,
  lastVerdict: null,
  lastReveal: null,
  winnerId: null,
  log: [],

  start: (numBots) => {
    const players: PracticePlayer[] = [
      { id: HUMAN_ID, name: "You", isBot: false, dice: rollDice(5), diceCount: 5, eliminated: false },
      ...Array.from({ length: numBots }, (_, i) => ({
        id: `bot-${i}`,
        name: `Bot ${i + 1}`,
        isBot: true,
        dice: rollDice(5),
        diceCount: 5,
        eliminated: false,
      })),
    ];
    set({
      players,
      currentBid: null,
      turnIdx: 0,
      phase: "playing",
      roundNumber: 1,
      lastVerdict: null,
      lastReveal: null,
      winnerId: null,
      log: pushLog([], `Round 1 — hands rolled for ${players.length} players.`),
    });
  },

  placeBid: (quantity, face) => {
    const { players, turnIdx, currentBid, log } = get();
    const bidder = players[turnIdx];
    if (!bidder) return;
    const escalates = currentBid
      ? quantity > currentBid.quantity || (quantity === currentBid.quantity && face > currentBid.face)
      : quantity >= 1;
    if (!escalates) return;
    set({
      currentBid: { quantity, face, bidderId: bidder.id },
      turnIdx: nextTurn(players, turnIdx),
      log: pushLog(log, `${bidder.name} bid ${quantity} × face ${face}${face === 1 ? " (wild)" : ""}.`),
    });
  },

  challenge: () => {
    const { players, currentBid, turnIdx, log } = get();
    if (!currentBid) return;
    const challenger = players[turnIdx];
    const total = countMatches(players, currentBid.face);
    const bidWasGood = total >= currentBid.quantity;
    const loserId = bidWasGood ? challenger.id : currentBid.bidderId;
    const loser = players.find((p) => p.id === loserId)!;

    const participants = activePlayers(players);
    const newDiceCount = loser.diceCount - 1;
    const updated = players.map((p) =>
      p.id === loserId ? { ...p, diceCount: newDiceCount, eliminated: newDiceCount === 0 } : p
    );
    const remaining = activePlayers(updated);

    let newLog = pushLog(
      log,
      `${challenger.name} called the bluff on ${currentBid.quantity} × face ${currentBid.face}.`
    );
    newLog = pushLog(
      newLog,
      bidWasGood ? "Bid was good — challenger loses." : "It was a lie — bidder loses.",
      bidWasGood ? "good" : "bad"
    );
    newLog = pushLog(
      newLog,
      newDiceCount > 0
        ? `${loser.name} loses a die — ${newDiceCount} left.`
        : `${loser.name} is out of dice and eliminated.`,
      "bad"
    );

    set({
      players: updated,
      lastVerdict: { bidWasGood, loserId },
      lastReveal: participants,
      phase: "revealed",
      winnerId: remaining.length === 1 ? remaining[0].id : null,
      log: newLog,
    });
  },

  continueAfterReveal: () => {
    const { players, log, winnerId, roundNumber } = get();
    if (winnerId) {
      set({ phase: "ended", log: pushLog(log, `${players.find((p) => p.id === winnerId)?.name} wins!`, "good") });
      return;
    }
    const rolled = players.map((p) => (p.eliminated ? p : { ...p, dice: rollDice(p.diceCount) }));
    const firstActive = rolled.findIndex((p) => !p.eliminated);
    set({
      players: rolled,
      currentBid: null,
      turnIdx: firstActive,
      phase: "playing",
      roundNumber: roundNumber + 1,
      lastVerdict: null,
      lastReveal: null,
      log: pushLog(log, `Round ${roundNumber + 1} — fresh hands rolled.`),
    });
  },
}));

export { HUMAN_ID, countMatches };
