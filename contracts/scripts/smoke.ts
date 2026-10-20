// Live end-to-end check on Arbitrum Sepolia against the real CoFHE network:
// 2-player room, encrypted rolls, own-hand decryption, bid, challenge, threshold-decrypted verdict, settlement.
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { arbSepolia } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { FheTypes } from "@cofhe/sdk";
import type { LiarsDice } from "../typechain-types";

const { ethers } = hre;

async function clientFor(wallet: any) {
  const client = createCofheClient(createCofheConfig({ supportedChains: [arbSepolia] }));
  const { publicClient, walletClient } = await Ethers6Adapter(ethers.provider, wallet);
  await client.connect(publicClient, walletClient);
  await client.acp.createSelf({ issuer: wallet.address });
  return client;
}

async function main() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${hre.network.name}.json`), "utf8"));
  const [alice] = await ethers.getSigners();
  const bob = ethers.Wallet.createRandom().connect(ethers.provider);
  const game = (await ethers.getContractAt("LiarsDice", deployment.LiarsDice)) as unknown as LiarsDice;
  console.log(`LiarsDice ${await game.VERSION()} at ${deployment.LiarsDice}`);

  await (await alice.sendTransaction({ to: bob.address, value: ethers.parseEther("0.004") })).wait();
  console.log(`funded temp player ${bob.address}`);

  await (await game.connect(alice).createRoom()).wait();
  const roomId = await game.roomCount();
  await (await game.connect(bob).joinRoom(roomId)).wait();
  await (await game.connect(alice).startGame(roomId)).wait();
  for (const p of [alice, bob]) {
    const r = await (await game.connect(p).rollDice(roomId)).wait();
    console.log(`room ${roomId}: ${p.address.slice(0, 8)} rolled (gas ${r!.gasUsed})`);
  }

  const aliceClient = await clientFor(alice);
  const hand: number[] = [];
  for (const h of await game.getHand(roomId, alice.address)) {
    hand.push(Number(await aliceClient.decryptForView(h, FheTypes.Uint8).withACP().execute()));
  }
  console.log(`alice peeked her own hand: [${hand.join(", ")}]`);

  await (await game.connect(alice).placeBid(roomId, 2, 3)).wait();
  const c = await (await game.connect(bob).challenge(roomId)).wait();
  console.log(`bob challenged "two 3s" (gas ${c!.gasUsed})`);

  const room = await game.getRoom(roomId);
  const { decryptedValue, signature } = await aliceClient.decryptForTx(room.verdictHandle).withoutACP().execute();
  const good = decryptedValue === 1n;
  await (await game.resolveChallenge(roomId, good, signature)).wait();

  const after = await game.getRoom(roomId);
  console.log(`verdict: bid was ${good ? "GOOD" : "a LIE"}; alice dice=${await game.diceLeft(roomId, alice.address)}, bob dice=${await game.diceLeft(roomId, bob.address)}; round=${after.round}, phase=${after.phase}`);

  const left = (await ethers.provider.getBalance(bob.address)) - ethers.parseEther("0.0003");
  if (left > 0n) await (await bob.sendTransaction({ to: alice.address, value: left })).wait();
  console.log("SMOKE TEST PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
