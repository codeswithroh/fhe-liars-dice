import { expect } from "chai";
import hre from "hardhat";
import { mock_getPlaintext } from "@cofhe/hardhat-plugin";
import { FheTypes } from "@cofhe/sdk";
import type { LiarsDice } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;
const Phase = { None: 0n, Lobby: 1n, Rolling: 2n, Bidding: 3n, Resolving: 4n, Finished: 5n };

async function faces(game: LiarsDice, roomId: bigint, player: string): Promise<number[]> {
  const handles = await game.getHand(roomId, player);
  return Promise.all(handles.map(async (h) => Number(await mock_getPlaintext(ethers.provider, BigInt(h)))));
}

function countMatches(hands: number[][], face: number): number {
  return hands.flat().filter((d) => d === face || (face !== 1 && d === 1)).length;
}

describe("LiarsDice", function () {
  let game: LiarsDice;
  let alice: HardhatEthersSigner, bob: HardhatEthersSigner, carol: HardhatEthersSigner;

  beforeEach(async () => {
    [alice, bob, carol] = await ethers.getSigners();
    game = (await ethers.deployContract("LiarsDice")) as unknown as LiarsDice;
  });

  async function setupRolled(players: HardhatEthersSigner[]) {
    await game.connect(players[0]).createRoom();
    const roomId = await game.roomCount();
    for (const p of players.slice(1)) await game.connect(p).joinRoom(roomId);
    await game.connect(players[0]).startGame(roomId);
    for (const p of players) await game.connect(p).rollDice(roomId);
    return roomId;
  }

  async function resolve(roomId: bigint) {
    const room = await game.getRoom(roomId);
    const client = await hre.cofhe.createClientWithBatteries(alice);
    const result = await client.decryptForTx(room.verdictHandle).withoutACP().execute();
    await game.resolveChallenge(roomId, result.decryptedValue === 1n, result.signature);
    return result.decryptedValue === 1n;
  }

  it("reports version 1.0.1", async () => {
    expect(await game.VERSION()).to.equal("1.0.1");
  });

  it("rolls 5 sealed dice per player with faces 1..6", async () => {
    const roomId = await setupRolled([alice, bob]);
    expect((await game.getRoom(roomId)).phase).to.equal(Phase.Bidding);
    for (const p of [alice, bob]) {
      const hand = await faces(game, roomId, p.address);
      expect(hand).to.have.length(5);
      hand.forEach((d) => expect(d).to.be.within(1, 6));
    }
  });

  it("lets a player decrypt only their own hand", async () => {
    const roomId = await setupRolled([alice, bob]);
    const [aliceDie] = await game.getHand(roomId, alice.address);
    const aliceClient = await hre.cofhe.createClientWithBatteries(alice);
    const own = await aliceClient.decryptForView(aliceDie, FheTypes.Uint8).withACP().execute();
    expect(Number(own)).to.equal(Number(await mock_getPlaintext(ethers.provider, BigInt(aliceDie))));

    const bobClient = await hre.cofhe.createClientWithBatteries(bob);
    let failed = false;
    try {
      await bobClient.decryptForView(aliceDie, FheTypes.Uint8).withACP().execute();
    } catch {
      failed = true;
    }
    expect(failed, "bob must not decrypt alice's die").to.equal(true);
  });

  it("enforces turn order and strictly increasing bids", async () => {
    const roomId = await setupRolled([alice, bob]);
    await expect(game.connect(bob).placeBid(roomId, 2, 3)).to.be.revertedWithCustomError(game, "NotYourTurn");
    await game.connect(alice).placeBid(roomId, 2, 3);
    await expect(game.connect(bob).placeBid(roomId, 2, 3)).to.be.revertedWithCustomError(game, "InvalidBid");
    await expect(game.connect(bob).placeBid(roomId, 2, 7)).to.be.revertedWithCustomError(game, "InvalidBid");
    await expect(game.connect(bob).placeBid(roomId, 11, 4)).to.be.revertedWithCustomError(game, "InvalidBid");
    await game.connect(bob).placeBid(roomId, 2, 4);
    await game.connect(alice).placeBid(roomId, 3, 2);
  });

  it("counts wild ones and settles a true bid against the challenger", async () => {
    const roomId = await setupRolled([alice, bob]);
    const hands = [await faces(game, roomId, alice.address), await faces(game, roomId, bob.address)];
    const face = 4;
    const actual = countMatches(hands, face);
    const qty = Math.max(1, actual); // a bid that is exactly true
    await game.connect(alice).placeBid(roomId, qty, face);
    await game.connect(bob).challenge(roomId);
    expect((await game.getRoom(roomId)).phase).to.equal(Phase.Resolving);

    const good = await resolve(roomId);
    expect(good).to.equal(actual >= qty);
    const loser = good ? bob : alice;
    expect(await game.diceLeft(roomId, loser.address)).to.equal(4n);
    const room = await game.getRoom(roomId);
    expect(room.phase).to.equal(Phase.Rolling);
    expect(room.round).to.equal(2n);
    expect(room.currentTurn).to.equal(loser.address);
  });

  it("settles a lying bid against the bidder", async () => {
    const roomId = await setupRolled([alice, bob]);
    await game.connect(alice).placeBid(roomId, 10, 6); // true only if all 10 dice are 6 or 1
    const hands = [await faces(game, roomId, alice.address), await faces(game, roomId, bob.address)];
    await game.connect(bob).challenge(roomId);
    const good = await resolve(roomId);
    expect(good).to.equal(countMatches(hands, 6) >= 10);
  });

  it("rejects a forged verdict", async () => {
    const roomId = await setupRolled([alice, bob]);
    await game.connect(alice).placeBid(roomId, 1, 5);
    await game.connect(bob).challenge(roomId);
    const room = await game.getRoom(roomId);
    const client = await hre.cofhe.createClientWithBatteries(alice);
    const { decryptedValue, signature } = await client.decryptForTx(room.verdictHandle).withoutACP().execute();
    await expect(game.resolveChallenge(roomId, decryptedValue !== 1n, signature)).to.be.reverted;
  });

  it("plays a 3-player game to a single winner and reveals eliminated hands", async () => {
    const players = [alice, bob, carol];
    const roomId = await setupRolled(players);
    const byAddr = new Map(players.map((p) => [p.address, p]));

    for (let guard = 0; guard < 40; guard++) {
      let room = await game.getRoom(roomId);
      if (room.phase === Phase.Finished) break;
      if (room.phase === Phase.Rolling) {
        for (const p of players) {
          if ((await game.diceLeft(roomId, p.address)) > 0n) await game.connect(p).rollDice(roomId);
        }
        room = await game.getRoom(roomId);
      }
      const opener = byAddr.get(room.currentTurn)!;
      await game.connect(opener).placeBid(roomId, 1, 6);
      const caller = byAddr.get((await game.getRoom(roomId)).currentTurn)!;
      await game.connect(caller).challenge(roomId);
      await resolve(roomId);
    }

    const room = await game.getRoom(roomId);
    expect(room.phase).to.equal(Phase.Finished);
    const alive = [];
    for (const p of players) if ((await game.diceLeft(roomId, p.address)) > 0n) alive.push(p.address);
    expect(alive).to.deep.equal([room.winner]);

    const tm = await hre.cofhe.mocks.getMockTaskManager();
    for (const p of players) {
      const [h] = await game.getHand(roomId, p.address);
      expect(await tm.isPubliclyAllowed(BigInt(h))).to.equal(true);
    }
  });
});
