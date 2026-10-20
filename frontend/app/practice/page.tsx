"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePracticeStore, HUMAN_ID } from "@/lib/practiceStore";
import { decideBotMove } from "@/lib/practiceBot";
import { BidControls } from "@/components/ui/BidControls";
import { RulesInfo } from "@/components/ui/RulesInfo";
import { DiceHandRow } from "@/components/ui/DiceFace";
import { DieLossFlash } from "@/components/ui/DieLossFlash";
import { WinCelebration } from "@/components/ui/WinCelebration";
import { RoundResultModal } from "@/components/ui/RoundResultModal";
import { WinnerModal } from "@/components/ui/WinnerModal";
import { FACE_LABELS } from "@/lib/contracts";

const Scene = dynamic(() => import("@/components/scene/Scene").then((m) => m.Scene), { ssr: false });

const BOT_MOVE_DELAY_MS = 1100;
const VERDICT_SUSPENSE_MS = 1300;

export default function PracticePage() {
  const {
    players,
    currentBid,
    turnIdx,
    phase,
    roundNumber,
    lastVerdict,
    lastReveal,
    winnerId,
    log,
    start,
    placeBid,
    challenge,
    continueAfterReveal,
  } = usePracticeStore();

  const [numBots, setNumBots] = useState(2);
  // Starts revealed (unlike the real table's async CoFHE unseal, practice mode's dice are
  // plain local state -- always current, no reason to hide them behind a manual first
  // click). The button still lets a player toggle it away if they want a cleaner view.
  const [peeking, setPeeking] = useState(true);
  const [resolving, setResolving] = useState(false);

  const human = players.find((p) => p.id === HUMAN_ID);
  const currentPlayer = players[turnIdx];
  const isHumanTurn = phase === "playing" && currentPlayer?.id === HUMAN_ID;

  // Bots act on their own turn with a short "thinking" delay so their moves are legible.
  useEffect(() => {
    if (phase !== "playing" || !currentPlayer?.isBot) return;
    const t = setTimeout(() => {
      const move = decideBotMove(
        currentPlayer,
        players.filter((p) => !p.eliminated),
        currentBid
      );
      if (move.action === "challenge") {
        setResolving(true);
        setTimeout(() => {
          challenge();
          setResolving(false);
        }, VERDICT_SUSPENSE_MS);
      } else if (move.quantity && move.face) {
        placeBid(move.quantity, move.face);
      }
    }, BOT_MOVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, currentPlayer, players, currentBid, placeBid, challenge]);

  function handleHumanChallenge() {
    setResolving(true);
    setTimeout(() => {
      challenge();
      setResolving(false);
    }, VERDICT_SUSPENSE_MS);
  }

  const opponents = players
    .filter((p) => p.id !== HUMAN_ID)
    .map((p) => ({
      label: `${p.name}${p.id === currentPlayer?.id ? " •" : ""}`,
      eliminated: p.eliminated,
      isTurn: p.id === currentPlayer?.id,
    }));

  const cupState = peeking ? "lifted" : "down";
  const myDiceDisplay = human?.dice ?? [1, 1, 1, 1, 1];

  const loser = lastVerdict ? players.find((p) => p.id === lastVerdict.loserId) : null;
  const winner = winnerId ? players.find((p) => p.id === winnerId) : null;

  if (phase === "idle") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16 text-center sm:px-6">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-50">Practice mode</h1>
          <RulesInfo />
        </div>
        <p className="text-sm text-slate-400">
          No wallet, no chain, no encryption — just the bluffing loop against a couple of bots so you can get a
          feel for the game. For real privacy-preserving play against other people, use{" "}
          <Link href="/lobby" className="text-cyan-300 hover:underline">
            the on-chain lobby
          </Link>{" "}
          instead.
        </p>
        <div className="panel flex flex-col items-center gap-4 rounded-xl p-6">
          <label className="text-xs text-slate-500">Number of bot opponents</label>
          <select
            value={numBots}
            onChange={(e) => setNumBots(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={() => start(numBots)}
            className="rounded-lg bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Start practice game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <WinCelebration active={phase === "ended" && Boolean(winnerId)} />

      {lastVerdict && loser && (
        <RoundResultModal
          open={phase === "revealed" && !resolving}
          onOpenChange={() => {}}
          bidWasGood={lastVerdict.bidWasGood}
          loserLabel={loser.name}
          eliminated={loser.eliminated}
          reveal={(lastReveal ?? []).map((p) => ({ label: p.name, dice: p.dice, isLoser: p.id === loser.id }))}
          continueLabel={winnerId ? "See result" : "Next round"}
          onContinue={continueAfterReveal}
        />
      )}

      {winner && (
        <WinnerModal
          open={phase === "ended"}
          onOpenChange={() => {}}
          winnerLabel={winner.name}
          isMe={winner.id === HUMAN_ID}
          footnote="Practice mode is offline and doesn't award credits — connect a wallet and play on the on-chain lobby to earn credits redeemable at the Fhenix swag shop."
          primaryLabel="Play again"
          onPrimary={() => start(numBots)}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-50">Practice table</h1>
            <RulesInfo />
          </div>
          <p className="text-xs text-slate-500">
            Round {roundNumber} &middot; No wallet, offline &middot;{" "}
            <button onClick={() => start(numBots)} className="text-cyan-300 hover:underline">
              Restart
            </button>
          </p>
        </div>
        {phase === "ended" && winnerId && (
          <span className="glow-text-cyan animate-pulse rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-sm font-semibold text-cyan-300">
            Winner: {players.find((p) => p.id === winnerId)?.name}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="relative h-[520px] overflow-hidden rounded-2xl border border-white/5 sm:h-[640px] lg:h-[680px]">
          <Scene
            cupState={cupState}
            myDice={myDiceDisplay}
            revealed={peeking}
            settleSignal={roundNumber}
            opponents={opponents}
            verdictActive={resolving}
            verdictGood={lastVerdict?.bidWasGood ?? null}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-200">Your hand</h3>
              <DieLossFlash diceCount={human?.diceCount ?? null} />
            </div>
            <div className="flex flex-col gap-3">
              {peeking && human && <DiceHandRow values={human.dice} />}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPeeking((v) => !v)}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
                >
                  {peeking ? "Hide dice" : "Peek under cup"}
                </button>
                {human?.eliminated && <span className="text-xs text-rose-400">You&apos;ve been eliminated.</span>}
              </div>
            </div>
          </div>

          {isHumanTurn && !resolving && (
            <>
              <BidControls
                currentQuantity={currentBid?.quantity ?? 0}
                currentFace={currentBid?.face ?? 0}
                hasBid={Boolean(currentBid)}
                disabled={false}
                onBid={(quantity, face) => placeBid(quantity, face)}
              />
              {currentBid && (
                <button
                  onClick={handleHumanChallenge}
                  className="rounded-lg bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500"
                >
                  Challenge — call bluff
                </button>
              )}
            </>
          )}

          {phase === "playing" && !isHumanTurn && !resolving && (
            <div className="panel rounded-xl p-4 text-sm text-slate-500">{currentPlayer?.name} is thinking…</div>
          )}

          {resolving && (
            <div className="panel rounded-xl border-rose-500/30 p-4 text-sm text-rose-300">
              Resolving the challenge…
            </div>
          )}

          <div className="panel rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Current bid</h3>
            {currentBid ? (
              <p className="text-lg font-semibold text-slate-100">
                {currentBid.quantity} × {FACE_LABELS[currentBid.face]}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  by {players.find((p) => p.id === currentBid.bidderId)?.name}
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-500">No bid yet this round.</p>
            )}
          </div>
        </div>
      </div>

      <div className="panel rounded-xl p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Table activity</h3>
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-sm">
          {log.length === 0 && <li className="text-slate-500">Nothing has happened yet.</li>}
          {[...log].reverse().map((entry) => (
            <li
              key={entry.id}
              className={
                entry.tone === "good" ? "text-green-400" : entry.tone === "bad" ? "text-rose-400" : "text-slate-400"
              }
            >
              {entry.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
