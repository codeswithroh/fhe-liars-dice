import { expect } from "chai";
import hre from "hardhat";
import { mock_getPlaintext } from "@cofhe/hardhat-plugin";
import { FheTypes } from "@cofhe/sdk";
import type { CofheClient } from "@cofhe/sdk";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { FheLiarsDice, MockLegacyPoints, TestableFheLiarsDice } from "../typechain-types";

const { ethers } = hre;
const Phase = { Lobby: 0n, InProgress: 1n, ChallengePending: 2n, RevealPending: 3n, Ended: 4n };

describe("FheLiarsDice", function () {
  let signers: HardhatEthersSigner[];
  let alice: HardhatEthersSigner, bob: HardhatEthersSigner, carol: HardhatEthersSigner;
  let legacy: MockLegacyPoints;
  let game: FheLiarsDice;
  let client: CofheClient;

  before(async () => {
    signers = await ethers.getSigners();
    [alice, bob, carol] = signers;
    client = await hre.cofhe.createClientWithBatteries(alice);
  });

  beforeEach(async () => {
    legacy = (await ethers.deployContract("MockLegacyPoints")) as unknown as MockLegacyPoints;
    game = (await ethers.deployContract("FheLiarsDice", [await legacy.getAddress()])) as unknown as FheLiarsDice;
  });

  // ---------------------------------------------------------------- helpers

  const plain = async (handle: string | bigint) => Number(await mock_getPlaintext(ethers.provider, BigInt(handle)));

  async function handOf(tableId: bigint, player: HardhatEthersSigner) {
    const handles = await game.connect(player).getMyDiceHandles(tableId);
    return Promise.all(handles.map(plain));
  }

  async function setup(players: HardhatEthersSigner[]) {
    await game.connect(players[0]).createTable(players.length);
    const tableId = (await game.nextTableId()) - 1n;
    for (const p of players.slice(1)) await game.connect(p).joinTable(tableId);
    await game.connect(players[0]).startGame(tableId);
    return tableId;
  }

  async function turnSigner(tableId: bigint) {
    const t = await game.getTable(tableId);
    return signers.find((s) => s.address === t.players[Number(t.turnIdx)])!;
  }

  /** Same round trip the frontend does: decryptForTx for the verdict, then each revealed die. */
  async function finalizeChallenge(tableId: bigint) {
    const handle = await game.getPendingVerdictHandle(tableId);
    const r = await client.decryptForTx(handle).withoutACP().execute();
    await game.finalizeChallenge(tableId, r.decryptedValue === 1n, r.signature);
    return r.decryptedValue === 1n;
  }

  async function finalizeReveal(tableId: bigint) {
    const [, handles] = await game.getPendingRevealHandles(tableId);
    const results = await Promise.all(handles.flat().map((h) => client.decryptForTx(h).withoutACP().execute()));
    return game.finalizeReveal(
      tableId,
      results.map((r) => Number(r.decryptedValue)),
      results.map((r) => r.signature),
    );
  }

  /** Current player bids an impossible quantity, next player challenges, round settles. */
  async function playLosingRound(tableId: bigint) {
    const bidder = await turnSigner(tableId);
    await game.connect(bidder).placeBid(tableId, 255, 6);
    await game.connect(await turnSigner(tableId)).challenge(tableId);
    await finalizeChallenge(tableId);
    await finalizeReveal(tableId);
    return bidder;
  }

  async function playToEnd(tableId: bigint) {
    for (let i = 0; i < 60 && (await game.getTable(tableId)).phase !== Phase.Ended; i++) {
      await playLosingRound(tableId);
    }
    const t = await game.getTable(tableId);
    expect(t.phase).to.equal(Phase.Ended);
    return t.winner;
  }

  // ---------------------------------------------------------------- lobby

  describe("lobby", () => {
    it("reports version 1.0.1 and the legacy contract", async () => {
      expect(await game.VERSION()).to.equal("1.0.1");
      expect(await game.legacy()).to.equal(await legacy.getAddress());
    });

    it("creates, joins and starts a table", async () => {
      const tableId = await setup([alice, bob, carol]);
      const t = await game.getTable(tableId);
      expect(t.host).to.equal(alice.address);
      expect(t.phase).to.equal(Phase.InProgress);
      expect(t.roundNumber).to.equal(1n);
      expect(t.players).to.deep.equal([alice.address, bob.address, carol.address]);
      expect(await game.getPlayerCount()).to.equal(3n);
    });

    it("rejects bad lobby actions", async () => {
      await expect(game.createTable(1)).to.be.revertedWithCustomError(game, "InvalidPlayerCount");
      await expect(game.createTable(9)).to.be.revertedWithCustomError(game, "InvalidPlayerCount");
      await game.connect(alice).createTable(2);
      await expect(game.connect(alice).joinTable(0)).to.be.revertedWithCustomError(game, "AlreadyJoined");
      await expect(game.connect(alice).startGame(0)).to.be.revertedWithCustomError(game, "NotEnoughPlayers");
      await game.connect(bob).joinTable(0);
      await expect(game.connect(carol).joinTable(0)).to.be.revertedWithCustomError(game, "TableFull");
      await expect(game.connect(bob).startGame(0)).to.be.revertedWithCustomError(game, "NotHost");
      await game.connect(alice).startGame(0);
      await expect(game.connect(carol).joinTable(0)).to.be.revertedWithCustomError(game, "TableNotInLobby");
    });
  });

  // ---------------------------------------------------------------- dice

  describe("encrypted dice", () => {
    it("rolls 5 dice per player with faces 1..6", async () => {
      const tableId = await setup([alice, bob]);
      for (const p of [alice, bob]) {
        const hand = await handOf(tableId, p);
        expect(hand).to.have.length(5);
        hand.forEach((d) => expect(d).to.be.within(1, 6));
      }
    });

    it("lets only the owner unseal their dice", async () => {
      const tableId = await setup([alice, bob]);
      const [die] = await game.connect(alice).getMyDiceHandles(tableId);
      const own = await client.decryptForView(die, FheTypes.Uint8).withACP().execute();
      expect(Number(own)).to.equal(await plain(die));

      const bobClient = await hre.cofhe.createClientWithBatteries(bob);
      let denied = false;
      try {
        await bobClient.decryptForView(die, FheTypes.Uint8).withACP().execute();
      } catch {
        denied = true;
      }
      expect(denied, "bob must not unseal alice's die").to.equal(true);
      await expect(game.connect(carol).getMyDiceHandles(tableId)).to.be.revertedWithCustomError(game, "NotAPlayer");
    });
  });

  // ---------------------------------------------------------------- bidding

  describe("bidding", () => {
    it("enforces turn order and escalation", async () => {
      const tableId = await setup([alice, bob]);
      await expect(game.connect(bob).placeBid(tableId, 1, 2)).to.be.revertedWithCustomError(game, "NotYourTurn");
      await expect(game.connect(alice).placeBid(tableId, 1, 7)).to.be.revertedWithCustomError(game, "InvalidFace");
      await expect(game.connect(alice).placeBid(tableId, 0, 3)).to.be.revertedWithCustomError(game, "InvalidQuantity");
      await expect(game.connect(alice).challenge(tableId)).to.be.revertedWithCustomError(game, "NoActiveBid");
      await game.connect(alice).placeBid(tableId, 2, 3);
      await expect(game.connect(bob).placeBid(tableId, 2, 3)).to.be.revertedWithCustomError(game, "MustEscalateBid");
      await expect(game.connect(bob).placeBid(tableId, 1, 6)).to.be.revertedWithCustomError(game, "MustEscalateBid");
      await game.connect(bob).placeBid(tableId, 2, 4);
      await game.connect(alice).placeBid(tableId, 3, 2);
      const history = await game.getBidHistory(tableId);
      expect(history.map((b) => [Number(b.quantity), Number(b.face)])).to.deep.equal([[2, 3], [2, 4], [3, 2]]);
    });
  });

  // ---------------------------------------------------------------- challenge

  describe("challenge", () => {
    for (const face of [1, 4]) {
      it(`computes the verdict over encrypted hands (face ${face}${face === 1 ? ", wilds not double-counted" : ", ones wild"})`, async () => {
        const tableId = await setup([alice, bob]);
        const dice = [...(await handOf(tableId, alice)), ...(await handOf(tableId, bob))];
        const actual = dice.filter((d) => d === face || (face !== 1 && d === 1)).length;
        const qty = Math.max(1, actual);
        await game.connect(alice).placeBid(tableId, qty, face);
        await game.connect(bob).challenge(tableId);
        expect((await game.getTable(tableId)).phase).to.equal(Phase.ChallengePending);

        const good = await finalizeChallenge(tableId);
        expect(good).to.equal(actual >= qty);
        const loser = good ? bob : alice;
        expect(await game.diceCount(tableId, loser.address)).to.equal(4n);
        expect((await game.getTable(tableId)).phase).to.equal(Phase.RevealPending);
      });
    }

    it("rejects a forged verdict", async () => {
      const tableId = await setup([alice, bob]);
      await game.connect(alice).placeBid(tableId, 1, 5);
      await game.connect(bob).challenge(tableId);
      const r = await client.decryptForTx(await game.getPendingVerdictHandle(tableId)).withoutACP().execute();
      await expect(game.finalizeChallenge(tableId, r.decryptedValue !== 1n, r.signature)).to.be.reverted;
    });

    it("guards phases", async () => {
      const tableId = await setup([alice, bob]);
      await expect(game.getPendingVerdictHandle(tableId)).to.be.revertedWithCustomError(game, "NoPendingChallenge");
      await expect(game.finalizeChallenge(tableId, true, "0x")).to.be.revertedWithCustomError(game, "NoPendingChallenge");
      await expect(game.finalizeReveal(tableId, [], [])).to.be.revertedWithCustomError(game, "NoPendingReveal");
    });
  });

  // ---------------------------------------------------------------- reveal

  describe("reveal", () => {
    it("publishes every hand of the round and starts the next one", async () => {
      const tableId = await setup([alice, bob]);
      const before = { a: await handOf(tableId, alice), b: await handOf(tableId, bob) };
      await game.connect(alice).placeBid(tableId, 255, 6);
      await game.connect(bob).challenge(tableId);
      await finalizeChallenge(tableId);

      const [players] = await game.getPendingRevealHandles(tableId);
      expect(players).to.deep.equal([alice.address, bob.address]);
      await expect(finalizeReveal(tableId))
        .to.emit(game, "HandsRevealed")
        .withArgs(tableId, [alice.address, bob.address], [before.a, before.b]);

      const t = await game.getTable(tableId);
      expect(t.phase).to.equal(Phase.InProgress);
      expect(t.roundNumber).to.equal(2n);
      expect(await handOf(tableId, alice)).to.have.length(4);
      expect(await handOf(tableId, bob)).to.have.length(5);
    });

    it("rejects a wrong-length or forged reveal", async () => {
      const tableId = await setup([alice, bob]);
      await game.connect(alice).placeBid(tableId, 255, 6);
      await game.connect(bob).challenge(tableId);
      await finalizeChallenge(tableId);
      const [, handles] = await game.getPendingRevealHandles(tableId);
      const results = await Promise.all(handles.flat().map((h) => client.decryptForTx(h).withoutACP().execute()));
      const values = results.map((r) => Number(r.decryptedValue));
      const sigs = results.map((r) => r.signature);

      await expect(game.finalizeReveal(tableId, values.slice(1), sigs.slice(1))).to.be.revertedWithCustomError(game, "RevealNotReady");
      const forged = [...values];
      forged[0] = (forged[0] % 6) + 1;
      await expect(game.finalizeReveal(tableId, forged, sigs)).to.be.reverted;
      await expect(game.revealAfterElimination(tableId, values, sigs)).to.emit(game, "HandsRevealed");
    });
  });

  // ---------------------------------------------------------------- points

  describe("points & leaderboard", () => {
    it("awards the winner of a full game exactly one point", async () => {
      const tableId = await setup([alice, bob]);
      const winner = await playToEnd(tableId);
      expect([alice.address, bob.address]).to.include(winner);
      expect(await game.getPoints(winner)).to.equal(1n);
      const loser = winner === alice.address ? bob : alice;
      expect(await game.getPoints(loser.address)).to.equal(0n);
      expect(await game.eliminated(tableId, loser.address)).to.equal(true);

      const [top, pts] = await game.getLeaderboard();
      expect(top).to.deep.equal([winner]);
      expect(pts).to.deep.equal([1n]);
      expect(await game.getLeaderboardRank(winner)).to.equal(1n);
    });

    it("accumulates points across tables and ranks a 3-player game", async () => {
      const t1 = await setup([alice, bob, carol]);
      const w1 = await playToEnd(t1);
      const t2 = await setup([alice, bob]);
      const w2 = await playToEnd(t2);
      const expected = new Map<string, bigint>();
      for (const w of [w1, w2]) expected.set(w, (expected.get(w) ?? 0n) + 1n);
      for (const [w, p] of expected) expect(await game.getPoints(w)).to.equal(p);

      const [top, pts] = await game.getLeaderboard();
      for (let i = 1; i < pts.length; i++) expect(pts[i - 1] >= pts[i]).to.equal(true);
      expect(new Set(top)).to.deep.equal(new Set(expected.keys()));
    });

    it("keeps the full scoreboard queryable and paginated", async () => {
      await setup([alice, bob, carol]);
      const [all] = await game.getAllPlayerPoints();
      expect(all).to.deep.equal([alice.address, bob.address, carol.address]);
      const [page1] = await game.getPlayerPoints(0, 2);
      const [page2] = await game.getPlayerPoints(2, 2);
      const [page3] = await game.getPlayerPoints(5, 2);
      expect(page1).to.deep.equal([alice.address, bob.address]);
      expect(page2).to.deep.equal([carol.address]);
      expect(page3).to.deep.equal([]);
    });

    it("keeps only the top LEADERBOARD_SIZE scorers, sorted, with stable ties", async () => {
      const t = (await ethers.deployContract("TestableFheLiarsDice", [ethers.ZeroAddress])) as unknown as TestableFheLiarsDice;
      const size = Number(await t.LEADERBOARD_SIZE());
      const wallets = Array.from({ length: size + 10 }, () => ethers.Wallet.createRandom().address);
      for (let i = 0; i < wallets.length; i++) await t.awardForTest(wallets[i], BigInt((i % 7) + 1));

      const [top, pts] = await t.getLeaderboard();
      expect(top).to.have.length(size);
      for (let i = 1; i < pts.length; i++) expect(pts[i - 1] >= pts[i]).to.equal(true);
      const cutoff = pts[pts.length - 1];
      for (let i = 0; i < wallets.length; i++) {
        if (BigInt((i % 7) + 1) > cutoff) expect(top).to.include(wallets[i]);
      }
      for (let i = 0; i < top.length; i++) expect(await t.getLeaderboardRank(top[i])).to.equal(BigInt(i + 1));

      // A late climber overtakes everyone; the evicted entry loses its rank.
      const evicted = top[top.length - 1];
      await t.awardForTest(wallets[0], 100n);
      const [top2] = await t.getLeaderboard();
      expect(top2[0]).to.equal(wallets[0]);
      const newcomer = ethers.Wallet.createRandom().address;
      await t.awardForTest(newcomer, 99n);
      const [top3] = await t.getLeaderboard();
      expect(top3[1]).to.equal(newcomer);
      expect(top3).to.have.length(size);
      if (!top3.includes(evicted)) expect(await t.getLeaderboardRank(evicted)).to.equal(0n);
      expect(await t.getPlayerCount()).to.equal(BigInt(wallets.length + 1));
    });
  });

  // ---------------------------------------------------------------- legacy carry-over

  describe("legacy points carry-over", () => {
    it("counts unsynced legacy points in getPoints", async () => {
      await legacy.set(carol.address, 7);
      expect(await game.getPoints(carol.address)).to.equal(7n);
      expect(await game.legacySynced(carol.address)).to.equal(false);
    });

    it("syncs permissionlessly, once, and ranks legacy players", async () => {
      await legacy.set(alice.address, 3);
      await legacy.set(bob.address, 9);
      await expect(game.connect(carol).syncLegacyPoints([alice.address, bob.address, carol.address]))
        .to.emit(game, "LegacyPointsSynced")
        .withArgs(bob.address, 9n, 9n);
      await legacy.set(alice.address, 50); // later legacy changes are not re-imported
      await game.syncLegacyPoints([alice.address]);
      expect(await game.getPoints(alice.address)).to.equal(3n);
      expect(await game.getPoints(bob.address)).to.equal(9n);
      const [top, pts] = await game.getLeaderboard();
      expect(top).to.deep.equal([bob.address, alice.address]);
      expect(pts).to.deep.equal([9n, 3n]);
      expect(await game.getPlayerCount()).to.equal(2n);
    });

    it("auto-syncs on join and adds new wins on top", async () => {
      await legacy.set(alice.address, 4);
      await legacy.set(bob.address, 4);
      const tableId = await setup([alice, bob]);
      expect(await game.legacySynced(alice.address)).to.equal(true);
      const winner = await playToEnd(tableId);
      expect(await game.getPoints(winner)).to.equal(5n);
      const [top] = await game.getLeaderboard();
      expect(top[0]).to.equal(winner);
    });

    it("never bricks the game if the legacy contract reverts or is unset", async () => {
      const bad = await ethers.deployContract("RevertingLegacyPoints");
      for (const legacyAddr of [await bad.getAddress(), ethers.ZeroAddress]) {
        game = (await ethers.deployContract("FheLiarsDice", [legacyAddr])) as unknown as FheLiarsDice;
        expect(await game.getPoints(alice.address)).to.equal(0n);
        const tableId = await setup([alice, bob]);
        expect((await game.getTable(tableId)).phase).to.equal(Phase.InProgress);
      }
    });
  });
});
