// Live end-to-end game on the deployed contract against the real CoFHE network:
// two players, encrypted rolls, owner-only peek, bid, challenge, signed verdict + reveal,
// played to the end, then checks the winner's point and leaderboard entry.
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { arbSepolia } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { FheTypes } from "@cofhe/sdk";
import type { FheLiarsDice } from "../typechain-types";

const { ethers } = hre;
const ENDED = 4n;

async function connect(wallet: any) {
  const client = createCofheClient(createCofheConfig({ supportedChains: [arbSepolia] }));
  const { publicClient, walletClient } = await Ethers6Adapter(ethers.provider, wallet);
  await client.connect(publicClient, walletClient);
  return client;
}

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${hre.network.name}.json`), "utf8"));
  const game = (await ethers.getContractAt("FheLiarsDice", dep.FheLiarsDice)) as unknown as FheLiarsDice;
  const [alice] = await ethers.getSigners();
  const bob = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log(`FheLiarsDice ${await game.VERSION()} at ${dep.FheLiarsDice}`);

  await (await alice.sendTransaction({ to: bob.address, value: ethers.parseEther("0.006") })).wait();
  const aliceClient = await connect(alice);
  const pointsBefore = { alice: await game.getPoints(alice.address), bob: await game.getPoints(bob.address) };

  await (await game.connect(alice).createTable(2)).wait();
  const tableId = (await game.nextTableId()) - 1n;
  await (await game.connect(bob).joinTable(tableId)).wait();
  const started = await (await game.connect(alice).startGame(tableId)).wait();
  console.log(`table ${tableId} started (gas ${started!.gasUsed})`);

  await aliceClient.acp.createSelf({ issuer: alice.address });
  const handles = await game.connect(alice).getMyDiceHandles(tableId);
  const hand = await Promise.all(handles.map(async (h) => Number(await aliceClient.decryptForView(h, FheTypes.Uint8).withACP().execute())));
  console.log(`alice peeked her own hand: [${hand.join(", ")}]`);

  const signerOf = (addr: string) => (addr === alice.address ? alice : bob);
  for (let round = 1; round <= 12; round++) {
    let t = await game.getTable(tableId);
    if (t.phase === ENDED) break;
    const bidder = signerOf(t.players[Number(t.turnIdx)]);
    await (await game.connect(bidder).placeBid(tableId, 255, 6)).wait();
    t = await game.getTable(tableId);
    await (await game.connect(signerOf(t.players[Number(t.turnIdx)])).challenge(tableId)).wait();

    const v = await aliceClient.decryptForTx(await game.getPendingVerdictHandle(tableId)).withoutACP().execute();
    await (await game.finalizeChallenge(tableId, v.decryptedValue === 1n, v.signature)).wait();
    const [, revealHandles] = await game.getPendingRevealHandles(tableId);
    const rs = await Promise.all(revealHandles.flat().map((h) => aliceClient.decryptForTx(h).withoutACP().execute()));
    await (await game.finalizeReveal(tableId, rs.map((r) => Number(r.decryptedValue)), rs.map((r) => r.signature))).wait();
    console.log(`round ${round}: bid ${v.decryptedValue === 1n ? "good" : "lie"}; dice alice=${await game.diceCount(tableId, alice.address)} bob=${await game.diceCount(tableId, bob.address)}`);
  }

  const t = await game.getTable(tableId);
  const winner = t.winner;
  const pointsAfter = { alice: await game.getPoints(alice.address), bob: await game.getPoints(bob.address) };
  const [top] = await game.getLeaderboard();
  console.log(`winner ${winner}; points alice ${pointsBefore.alice}->${pointsAfter.alice}, bob ${pointsBefore.bob}->${pointsAfter.bob}; winner rank ${await game.getLeaderboardRank(winner)} of ${top.length}`);

  const ok =
    t.phase === ENDED &&
    (winner === bob.address
      ? pointsAfter.bob === pointsBefore.bob + 1n && pointsAfter.alice === pointsBefore.alice
      : pointsAfter.alice === pointsBefore.alice + 1n && pointsAfter.bob === pointsBefore.bob);

  const left = (await ethers.provider.getBalance(bob.address)) - ethers.parseEther("0.0003");
  if (left > 0n) await (await bob.sendTransaction({ to: alice.address, value: left })).wait();
  if (!ok) throw new Error("SMOKE TEST FAILED");
  console.log("SMOKE TEST PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
