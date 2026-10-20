"use client";

import { useState } from "react";
import { useWatchContractEvent } from "wagmi";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS } from "@/lib/contracts";

export interface TableLogEntry {
  id: string;
  text: string;
  tone: "neutral" | "good" | "bad";
}

function short(addr?: string) {
  if (!addr) return "?";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Caller must remount this hook's owner on `tableId` change (e.g. `key={tableId}` on the
 *  consuming component) -- state here isn't reset internally so it stays a plain hook. */
export interface RevealedHands {
  players: string[];
  dice: number[][];
}

export function useTableEvents(tableId: number, onRefetch: () => void) {
  const [log, setLog] = useState<TableLogEntry[]>([]);
  const [lastVerdict, setLastVerdict] = useState<{ good: boolean; loser: string } | null>(null);
  const [lastReveal, setLastReveal] = useState<RevealedHands | null>(null);
  const [lastEliminated, setLastEliminated] = useState<string | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  useWatchContractEvent({
    address: FHE_LIARS_DICE_ADDRESS,
    abi: fheLiarsDiceAbi,
    onLogs(logs) {
      const entries: TableLogEntry[] = [];
      for (const l of logs) {
        const a = l.args as Record<string, unknown>;
        if ("tableId" in a && a.tableId !== BigInt(tableId)) continue;
        const key = `${l.transactionHash}-${l.logIndex}`;
        switch (l.eventName) {
          case "PlayerJoined":
            entries.push({ id: key, text: `${short(a.player as string)} joined the table`, tone: "neutral" });
            break;
          case "GameStarted":
            entries.push({ id: key, text: "Game started — hands rolled", tone: "neutral" });
            break;
          case "RoundStarted":
            entries.push({ id: key, text: `Round ${a.roundNumber} — new hands rolled`, tone: "neutral" });
            break;
          case "BidPlaced":
            entries.push({
              id: key,
              text: `${short(a.player as string)} bid ${a.quantity} × face ${a.face}`,
              tone: "neutral",
            });
            break;
          case "ChallengeCalled":
            entries.push({ id: key, text: `${short(a.challenger as string)} called the bluff`, tone: "neutral" });
            break;
          case "VerdictRevealed": {
            const good = Boolean(a.bidWasGood);
            setLastVerdict({ good, loser: a.loser as string });
            entries.push({
              id: key,
              text: good ? "Bid was good — challenger loses" : "It was a lie — bidder loses",
              tone: good ? "good" : "bad",
            });
            break;
          }
          case "PlayerEliminated":
            setLastEliminated(a.player as string);
            entries.push({ id: key, text: `${short(a.player as string)} is eliminated`, tone: "bad" });
            break;
          case "HandsRevealed": {
            const players = a.players as string[];
            const dice = (a.dice as readonly (readonly bigint[])[]).map((hand) => hand.map((d) => Number(d)));
            setLastReveal({ players: [...players], dice });
            entries.push({ id: key, text: "Hands revealed for the round", tone: "neutral" });
            break;
          }
          case "TableEnded":
            setWinner(a.winner as string);
            entries.push({ id: key, text: `${short(a.winner as string)} wins the table`, tone: "good" });
            break;
        }
      }
      if (entries.length) setLog((prev) => [...prev, ...entries]);
      onRefetch();
    },
  });

  return { log, lastVerdict, lastReveal, lastEliminated, winner };
}
