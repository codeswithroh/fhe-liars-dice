// Imports every legacy winner's points into the new deployment so the on-chain leaderboard is
// complete from day one. Safe to re-run: syncLegacyPoints is idempotent and reads the amounts
// from the legacy contract on-chain, so this script can't change anyone's totals.
import hre from "hardhat";
import fs from "fs";
import path from "path";
import type { FheLiarsDice } from "../typechain-types";

const LOG_RANGE = 9_000_000; // public Arbitrum RPC caps eth_getLogs at 10M blocks
const BATCH = 60;

/** The public RPC times out now and then; every call here is safe to repeat. */
async function retry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${hre.network.name}.json`), "utf8"));
  const game = (await hre.ethers.getContractAt("FheLiarsDice", dep.FheLiarsDice)) as unknown as FheLiarsDice;
  const legacyAddr = await game.legacy();
  const topic = hre.ethers.id("PointsAwarded(address,uint256)");

  const fromBlock = Number(process.env.LEGACY_FROM_BLOCK ?? 295025899);
  const latest = await hre.ethers.provider.getBlockNumber();
  const winners = new Set<string>();
  for (let start = fromBlock; start <= latest; start += LOG_RANGE) {
    const end = Math.min(start + LOG_RANGE - 1, latest);
    const logs = await retry(() => hre.ethers.provider.getLogs({ address: legacyAddr, topics: [topic], fromBlock: start, toBlock: end }));
    for (const l of logs) winners.add(hre.ethers.getAddress("0x" + l.topics[1].slice(26)));
  }
  console.log(`legacy ${legacyAddr}: ${winners.size} distinct winners`);

  const pending: string[] = [];
  for (const w of winners) if (!(await retry(() => game.legacySynced(w)))) pending.push(w);
  console.log(`${pending.length} still to sync`);

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const r = await retry(async () => (await game.syncLegacyPoints(batch)).wait());
    console.log(`synced ${Math.min(i + BATCH, pending.length)}/${pending.length} (gas ${r!.gasUsed})`);
  }

  const [top, pts] = await retry(() => game.getLeaderboard());
  console.log(`leaderboard: ${top.length} entries; top 5:`);
  for (let i = 0; i < Math.min(5, top.length); i++) console.log(`  ${i + 1}. ${top[i]} ${pts[i]}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
