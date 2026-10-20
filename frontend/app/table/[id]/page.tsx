"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { BaseError } from "viem";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS, GamePhase, FACE_LABELS } from "@/lib/contracts";
import { useTableState } from "@/lib/useTableState";
import { useMyHand } from "@/lib/useMyHand";
import { useTableEvents } from "@/lib/useTableEvents";
import { useSendTx } from "@/lib/useSendTx";
import { useFinalizeChallenge, useFinalizeReveal } from "@/lib/useFinalize";
import { BidControls } from "@/components/ui/BidControls";
import { RulesInfo } from "@/components/ui/RulesInfo";
import { DiceHandRow } from "@/components/ui/DiceFace";
import { DieLossFlash } from "@/components/ui/DieLossFlash";
import { WinCelebration } from "@/components/ui/WinCelebration";
import { RoundResultModal } from "@/components/ui/RoundResultModal";
import { WinnerModal } from "@/components/ui/WinnerModal";

const Scene = dynamic(() => import("@/components/scene/Scene").then((m) => m.Scene), { ssr: false });

function short(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof BaseError) return err.shortMessage ?? err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export default function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Keyed so the whole subtree (and its per-table hook state) remounts on table switch.
  return <TableView key={id} tableId={Number(id)} />;
}

function TableView({ tableId }: { tableId: number }) {
  const { address } = useAccount();
  const router = useRouter();
  const { sendTx, isPending } = useSendTx();
  const { finalizeChallenge } = useFinalizeChallenge();
  const { finalizeReveal } = useFinalizeReveal();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const state = useTableState(tableId);
  const hand = useMyHand(tableId);
  const { log, lastVerdict, lastReveal, lastEliminated } = useTableEvents(tableId, state.refetch);

  // The round-result modal should pop up exactly once per resolved challenge and stay
  // closed once dismissed, even though `lastReveal` itself doesn't get cleared between
  // rounds -- tracking *which* reveal was last dismissed (by object identity, a fresh one
  // every `HandsRevealed` event) derives the open state directly during render instead of
  // needing an effect to imperatively flip a separate "is open" flag in response to it.
  const [dismissedReveal, setDismissedReveal] = useState<typeof lastReveal>(null);
  const roundModalOpen = Boolean(lastReveal) && lastReveal !== dismissedReveal;

  const isPlayer = state.players.some((p) => p.toLowerCase() === address?.toLowerCase());
  const myIndex = state.players.findIndex((p) => p.toLowerCase() === address?.toLowerCase());
  const isMyTurn = isPlayer && Number(state.turnIdx ?? -1) === myIndex;
  const isHost = state.host?.toLowerCase() === address?.toLowerCase();
  const isEliminated = myIndex >= 0 && Boolean(state.eliminatedFlags[myIndex]);
  const phase = Number(state.phase ?? 0);

  // A real dice cup doesn't make you lift it yourself every round -- the moment a fresh
  // hand is rolled, you'd just look. Auto-peek (and re-peek on every new round, since a
  // reroll makes any previously-revealed values stale) instead of leaving it as a manual
  // action gated behind a button; the button still lets a player re-hide/re-reveal if they
  // want the dice out of the way.
  const peekedRound = useRef<number | null>(null);
  const roundNumber = Number(state.roundNumber ?? 0);
  useEffect(() => {
    if (!isPlayer || phase === GamePhase.Lobby || peekedRound.current === roundNumber) return;
    peekedRound.current = roundNumber;
    hand.hide();
    hand.peek();
    // `hand` is a fresh object every render (see useMyHand), so it's in the deps for
    // correctness but the roundNumber guard above is what actually prevents this from
    // re-running on every one of those renders.
  }, [isPlayer, phase, roundNumber, hand]);

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    setActionError(null);
    try {
      await fn();
      state.refetch();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const opponents = useMemo(
    () =>
      state.players
        .map((p, i) => ({ addr: p, i }))
        .filter(({ addr }) => addr.toLowerCase() !== address?.toLowerCase())
        .map(({ addr, i }) => ({
          label: `${short(addr)}${i === Number(state.turnIdx) ? " •" : ""}`,
          eliminated: Boolean(state.eliminatedFlags[i]),
          isTurn: i === Number(state.turnIdx),
        })),
    [state.players, state.eliminatedFlags, state.turnIdx, address]
  );

  const cupState = hand.values ? "lifted" : "down";
  const myDiceDisplay = hand.values ?? [1, 1, 1, 1, 1];

  return (
    <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <WinCelebration active={phase === GamePhase.Ended && Boolean(state.winner)} />

      {lastVerdict && lastReveal && (
        <RoundResultModal
          open={roundModalOpen}
          onOpenChange={(open) => !open && setDismissedReveal(lastReveal)}
          bidWasGood={lastVerdict.good}
          loserLabel={short(lastVerdict.loser)}
          eliminated={lastEliminated?.toLowerCase() === lastVerdict.loser.toLowerCase()}
          reveal={lastReveal.players.map((p, i) => ({
            label: short(p),
            dice: lastReveal.dice[i] ?? [],
            isLoser: p.toLowerCase() === lastVerdict.loser.toLowerCase(),
          }))}
          continueLabel="Continue"
          onContinue={() => setDismissedReveal(lastReveal)}
        />
      )}

      {phase === GamePhase.Ended && state.winner && (
        <WinnerModal
          open
          onOpenChange={() => {}}
          winnerLabel={short(state.winner)}
          isMe={state.winner.toLowerCase() === address?.toLowerCase()}
          pointsNote={state.winner.toLowerCase() === address?.toLowerCase() ? "+1 credit" : undefined}
          primaryLabel="Back to lobby"
          onPrimary={() => router.push("/lobby")}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-50">Table #{tableId}</h1>
            <RulesInfo />
          </div>
          <p className="text-xs text-slate-500">
            Round {Number(state.roundNumber ?? 0)} &middot; Host {short(state.host)}
          </p>
        </div>
        {phase === GamePhase.Ended && state.winner && (
          <span className="glow-text-cyan animate-pulse rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-sm font-semibold text-cyan-300">
            Winner: {short(state.winner)}
            {state.winner.toLowerCase() === address?.toLowerCase() && " · +1 credit"}
          </span>
        )}
      </div>

      {actionError && (
        <div className="panel rounded-xl border-rose-500/30 p-4">
          <p className="text-sm text-rose-300">{actionError}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="relative h-[520px] overflow-hidden rounded-2xl border border-white/5 sm:h-[640px] lg:h-[680px]">
          <Scene
            cupState={cupState}
            myDice={myDiceDisplay}
            revealed={Boolean(hand.values)}
            settleSignal={Number(state.roundNumber ?? 0)}
            opponents={opponents}
            verdictActive={phase === GamePhase.ChallengePending}
            verdictGood={lastVerdict?.good ?? null}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-200">Your hand</h3>
              <DieLossFlash diceCount={hand.handles?.length ?? null} />
            </div>
            {!isPlayer && <p className="text-sm text-slate-500">You are not seated at this table.</p>}
            {isPlayer && phase === GamePhase.Lobby && (
              <p className="text-sm text-slate-500">Waiting for the host to start the game.</p>
            )}
            {isPlayer && phase !== GamePhase.Lobby && (
              <div className="flex flex-col gap-3">
                {hand.values && <DiceHandRow values={hand.values} />}
                <div className="flex items-center gap-3">
                  <button
                    onClick={hand.values ? hand.hide : hand.peek}
                    disabled={hand.peeking}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {hand.peeking ? "Unsealing…" : hand.values ? "Hide dice" : "Peek under cup"}
                  </button>
                  {hand.error && <span className="text-xs text-rose-400">{hand.error}</span>}
                </div>
              </div>
            )}
            {isEliminated && <p className="mt-2 text-xs text-rose-400">You&apos;ve been eliminated from this table.</p>}
          </div>

          {isPlayer && phase === GamePhase.Lobby && isHost && (
            <button
              onClick={() =>
                run("start", () =>
                  sendTx({
                    address: FHE_LIARS_DICE_ADDRESS,
                    abi: fheLiarsDiceAbi,
                    functionName: "startGame",
                    args: [BigInt(tableId)],
                  })
                )
              }
              disabled={isPending || state.players.length < 2}
              className="rounded-lg bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
            >
              {busy === "start" ? "Starting…" : `Start game (${state.players.length} joined)`}
            </button>
          )}

          {isPlayer && phase === GamePhase.InProgress && isMyTurn && !isEliminated && (
            <>
              <BidControls
                currentQuantity={Number(state.currentBid?.quantity ?? 0)}
                currentFace={Number(state.currentBid?.face ?? 0)}
                hasBid={Boolean(state.hasBid)}
                disabled={isPending}
                onBid={(quantity, face) =>
                  run("bid", () =>
                    sendTx({
                      address: FHE_LIARS_DICE_ADDRESS,
                      abi: fheLiarsDiceAbi,
                      functionName: "placeBid",
                      args: [BigInt(tableId), quantity, face],
                    })
                  )
                }
              />
              {state.hasBid && (
                <button
                  onClick={() =>
                    run("challenge", () =>
                      sendTx({
                        address: FHE_LIARS_DICE_ADDRESS,
                        abi: fheLiarsDiceAbi,
                        functionName: "challenge",
                        args: [BigInt(tableId)],
                      })
                    )
                  }
                  disabled={isPending}
                  className="rounded-lg bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500 disabled:opacity-40"
                >
                  {busy === "challenge" ? "Calling bluff…" : "Challenge — call bluff"}
                </button>
              )}
            </>
          )}

          {phase === GamePhase.ChallengePending && (
            <button
              onClick={() => run("finalizeChallenge", () => finalizeChallenge(tableId))}
              disabled={isPending}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
            >
              {busy === "finalizeChallenge" ? "Unsealing verdict…" : "Reveal verdict"}
            </button>
          )}

          {phase === GamePhase.RevealPending && (
            <button
              onClick={() => run("finalizeReveal", () => finalizeReveal(tableId))}
              disabled={isPending}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-40"
            >
              {busy === "finalizeReveal" ? "Unsealing hands…" : "Reveal hands"}
            </button>
          )}

          <div className="panel rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Current bid</h3>
            {state.hasBid ? (
              <p className="text-lg font-semibold text-slate-100">
                {Number(state.currentBid?.quantity)} × {FACE_LABELS[Number(state.currentBid?.face)]}
                <span className="ml-2 text-xs font-normal text-slate-500">by {short(state.currentBid?.bidder)}</span>
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
                entry.tone === "good"
                  ? "text-green-400"
                  : entry.tone === "bad"
                    ? "text-rose-400"
                    : "text-slate-400"
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
