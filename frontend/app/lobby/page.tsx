"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { decodeEventLog, BaseError, ContractFunctionRevertedError } from "viem";
import { fheLiarsDiceAbi, FHE_LIARS_DICE_ADDRESS } from "@/lib/contracts";
import { TARGET_CHAIN_ID } from "@/lib/wagmi";
import { useTables, TABLES_PAGE_SIZE } from "@/lib/useTables";
import { useSendTx } from "@/lib/useSendTx";
import { useLeaderboard, useLeaderboardRank, usePoints } from "@/lib/usePoints";
import { DicesIcon, HashIcon, LogInIcon, TrophyIcon, UsersRoundIcon } from "@/components/ui/icons";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Shared "game asset card" shape used across the lobby -- an icon badge + title up top,
 *  controls in the middle, one prominent action button pinned to the end. Modeled on the
 *  icon-forward mission/upgrade cards from gacha-style game UIs the user referenced,
 *  translated into this project's locked cyan/hairline-border technical-mood tokens
 *  (see .tastemaker/style-lock.md) rather than copying that reference's own skin. */
function GameAssetCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel rounded-xl border-white/10 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** The reference's "Go" buttons: short, bold, high-contrast, unmistakably an action --
 *  not a quiet text link. Reused for every primary action in the redesigned lobby. */
function GoButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`rounded-lg bg-cyan-600 px-5 py-2 text-sm font-bold tracking-wide text-white transition hover:bg-cyan-500 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

const PHASE_LABEL = ["Open", "Playing", "Resolving", "Revealing", "Ended"];

/** Placeholder matching the real table card's shape exactly (icon box + two text lines +
 *  action button) so the grid doesn't visibly reflow once data lands. */
function TableCardSkeleton() {
  return (
    <div className="panel flex items-center gap-3 rounded-xl p-4">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-white/5" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-24 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
      </div>
      <div className="h-8 w-14 shrink-0 animate-pulse rounded-lg bg-white/5" />
    </div>
  );
}

// Wallets (Privy's included) generally can't decode a contract's custom Solidity errors
// on their own, so a revert like `AlreadyJoined()` surfaces to the user as an opaque
// "Execution reverted for an unknown reason" -- decode the ones a player can actually hit
// here into plain language instead.
const REVERT_MESSAGES: Record<string, string> = {
  AlreadyJoined: "You're already in this table -- resume it instead of joining again.",
  TableFull: "That table is already full.",
  TableNotInLobby: "That table isn't open to join anymore.",
};

function errorMessage(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    const errorName = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
    if (errorName && REVERT_MESSAGES[errorName]) return REVERT_MESSAGES[errorName];
    return err.shortMessage ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export default function LobbyPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const onRightChain = chainId === TARGET_CHAIN_ID;

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinId, setJoinId] = useState("");
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const { sendTx, isPending: signing } = useSendTx();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const {
    data: receipt,
    isLoading: confirming,
    isError: receiptFailed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: pendingHash });

  const { tables, openTables, isLoading, totalPages } = useTables(page);
  const { rows: leaderboard, isLoading: leaderboardLoading, isError: leaderboardError } = useLeaderboard();
  const { rank: myRank } = useLeaderboardRank(address);
  const { points: myPoints } = usePoints(address);

  // The host (and anyone else already seated) shows up in `players` the moment they
  // create/join a table -- re-submitting `joinTable` for a table you're already in reverts
  // on-chain (`AlreadyJoined`), which the wallet can only surface as an opaque "execution
  // reverted" popup. Route straight to the table instead of ever sending that tx.
  function isMember(t: { players: `0x${string}`[] }) {
    return !!address && t.players.some((p) => p.toLowerCase() === address.toLowerCase());
  }

  async function handleCreate() {
    setFormError(null);
    try {
      const hash = await sendTx({
        address: FHE_LIARS_DICE_ADDRESS,
        abi: fheLiarsDiceAbi,
        functionName: "createTable",
        args: [maxPlayers],
      });
      setPendingHash(hash);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  async function handleJoin(id: number) {
    setFormError(null);
    const existing = tables.find((t) => t.id === id);
    if (existing && isMember(existing)) {
      router.push(`/table/${id}`);
      return;
    }
    setJoiningId(id);
    try {
      await sendTx({
        address: FHE_LIARS_DICE_ADDRESS,
        abi: fheLiarsDiceAbi,
        functionName: "joinTable",
        args: [BigInt(id)],
      });
      // Navigate as soon as the wallet confirms sending; the table page itself polls
      // on-chain state and will reflect the join once it's mined.
      router.push(`/table/${id}`);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setJoiningId(null);
    }
  }

  // Navigation is a real external-system effect (not state mirroring), so it stays in an
  // effect; errors/reverts are derived directly below instead of synced into state.
  useEffect(() => {
    if (!receipt || receipt.status !== "success") return;
    const created = receipt.logs
      .map((log) => {
        try {
          return decodeEventLog({ abi: fheLiarsDiceAbi, ...log });
        } catch {
          return null;
        }
      })
      .find((e) => e?.eventName === "TableCreated");
    if (created && created.eventName === "TableCreated") {
      router.push(`/table/${created.args.tableId.toString()}`);
    }
  }, [receipt, router]);

  const chainError = receiptFailed
    ? errorMessage(receiptError)
    : receipt?.status === "reverted"
      ? "The transaction reverted on-chain. Please try again."
      : null;
  const displayError = formError ?? chainError;
  const creating = signing || confirming;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Casual lobby</h1>
        <p className="mt-1 text-sm text-slate-400">Create a table or join an open one. No wagers, no ranking — just bluffing.</p>
      </div>

      {!isConnected && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
          <p className="text-sm text-slate-300">Connect a wallet to create or join a real, on-chain table.</p>
          <ConnectButton />
        </div>
      )}

      {!isConnected && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl border-cyan-500/20 p-5">
          <div>
            <p className="text-sm text-slate-300">No wallet? Try the game for free, right now.</p>
            <p className="text-xs text-slate-500">
              Practice mode plays fully offline against bots &mdash; same table, same rules, no chain.
            </p>
          </div>
          <Link
            href="/practice"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Play without a wallet
          </Link>
        </div>
      )}

      {isConnected && !onRightChain && (
        <div className="panel flex items-center justify-between rounded-xl border-rose-500/30 p-5">
          <p className="text-sm text-rose-300">Wrong network — FHE Liar&apos;s Dice runs on Arbitrum Sepolia.</p>
          <button
            onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
            disabled={switching}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {switching ? "Switching…" : "Switch network"}
          </button>
        </div>
      )}

      {displayError && (
        <div className="panel rounded-xl border-rose-500/30 p-4">
          <p className="text-sm text-rose-300">{displayError}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <GameAssetCard icon={<DicesIcon className="h-5 w-5" />} title="Create a table" subtitle="Start a fresh game">
          <label className="text-xs text-slate-500">Max players</label>
          <select
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <GoButton onClick={handleCreate} disabled={!isConnected || !onRightChain || creating} className="ml-auto">
            {signing ? "Confirm…" : confirming ? "Creating…" : "Go"}
          </GoButton>
        </GameAssetCard>

        <GameAssetCard icon={<LogInIcon className="h-5 w-5" />} title="Join by table ID" subtitle="Already have a code?">
          <div className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2">
            <HashIcon className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="e.g. 3"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
            />
          </div>
          <GoButton
            onClick={() => joinId && handleJoin(Number(joinId))}
            disabled={!isConnected || !onRightChain || joinId === "" || joiningId !== null}
            className="ml-auto"
          >
            {joiningId !== null ? "Joining…" : "Go"}
          </GoButton>
        </GameAssetCard>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <UsersRoundIcon className="h-4 w-4 text-cyan-300" />
          Open tables
        </h2>
        {!isLoading && openTables.length === 0 && (
          <p className="text-sm text-slate-500">
            {page === 0 ? "No open tables yet — be the first to create one." : "No open tables on this page."}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {isLoading
            ? Array.from({ length: TABLES_PAGE_SIZE }, (_, i) => <TableCardSkeleton key={i} />)
            : openTables.map((t) => {
                const mine = isMember(t);
                return (
                  <div
                    key={t.id}
                    className="panel flex items-center gap-3 rounded-xl p-4 [animation:fadeIn_250ms_ease-out]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                      <DicesIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-100">
                        Table #{t.id}
                        {mine && <span className="ml-2 text-xs font-normal text-cyan-400">You&apos;re in</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t.playerCount}/{t.maxPlayers} players &middot; {PHASE_LABEL[t.phase]}
                      </p>
                    </div>
                    <GoButton
                      onClick={() => (mine ? router.push(`/table/${t.id}`) : handleJoin(t.id))}
                      disabled={!mine && (!isConnected || !onRightChain || joiningId !== null)}
                      className="px-4 py-2 text-xs"
                    >
                      {mine ? "Resume" : joiningId === t.id ? "…" : "Go"}
                    </GoButton>
                  </div>
                );
              })}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
            >
              &larr; Newer
            </button>
            <span className="text-xs text-slate-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
            >
              Older &rarr;
            </button>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <TrophyIcon className="h-4 w-4 text-cyan-300" />
          Leaderboard
        </h2>
        {leaderboardLoading && <p className="text-sm text-slate-500">Loading leaderboard…</p>}
        {leaderboardError && !leaderboardLoading && (
          <p className="text-sm text-slate-500">Couldn&apos;t load the leaderboard — retrying…</p>
        )}
        {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 && (
          <p className="text-sm text-slate-500">No games won yet — the last player standing earns 1 credit on-chain.</p>
        )}
        {leaderboard.length > 0 && (
          <div className="panel divide-y divide-white/5 rounded-xl">
            {leaderboard.slice(0, 10).map((row, i) => (
              <div key={row.player} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                    i === 0
                      ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                      : "border border-white/10 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 font-mono text-sm text-slate-200">{short(row.player)}</span>
                <span className="glow-text-cyan text-sm font-semibold text-cyan-300">
                  {row.points.toString()} credit{row.points === BigInt(1) ? "" : "s"}
                </span>
              </div>
            ))}
            {address && myRank !== undefined && (myRank === 0 || myRank > 10) && (
              <div className="flex items-center gap-3 bg-cyan-500/5 px-4 py-3">
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-white/10 px-1 text-xs font-bold text-slate-400">
                  {myRank === 0 ? "—" : myRank}
                </span>
                <span className="flex-1 font-mono text-sm text-slate-200">You · {short(address)}</span>
                <span className="text-sm font-semibold text-cyan-300">
                  {myPoints.toString()} credit{myPoints === BigInt(1) ? "" : "s"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
