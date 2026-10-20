// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {FHE, ebool, euint8} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @dev cofhe-contracts v0.1.4 dropped the old `FHE.decrypt(...)` + automatic-relayer model
///      entirely. The current flow (per Fhenix's "Migrating from FHE.decrypt" guide) is:
///        1. Contract calls `FHE.allowPublic(ctHash)` to mark a value decryptable.
///        2. An off-chain client (this repo's frontend, via `@cofhe/sdk`'s
///           `client.decryptForTx(ctHash).withoutPermit().execute()`) fetches the plaintext
///           and a Threshold Network signature from the coprocessor -- there is no automatic
///           relayer that does this on its own.
///        3. Anyone submits that (plaintext, signature) pair on-chain via
///           `FHE.publishDecryptResult(ctHash, plaintext, signature)`, which verifies the
///           signature itself before accepting it.
///      `finalizeChallenge`/`finalizeReveal` below take the fetched plaintext(s) and
///      signature(s) as arguments accordingly, rather than being no-arg polls.

/// @title FheLiarsDice
/// @notice Casual-mode Liar's Dice with encrypted per-player hands on Fhenix CoFHE.
///         Dice are generated and stored encrypted on-chain. Bids are public. A challenge
///         reveals only whether the bid was good or a lie -- never the underlying count --
///         computed homomorphically over every active player's encrypted hand. Individual
///         hands are only decrypted after a challenge resolves and that round's players
///         are eliminated/advance, matching a physical Liar's Dice showdown.
contract FheLiarsDice {
    uint8 public constant DICE_PER_PLAYER = 5;
    uint8 public constant WILD_FACE = 1;
    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 8;
    /// @dev FHE.randomEuint8() % 6 has a slight modulo bias (256 isn't divisible by 6):
    ///      faces 1-4 are drawn ~0.4% more often than faces 5-6. Acceptable for a casual
    ///      MVP; a bias-free rejection-sampling scheme would need multiple encrypted
    ///      comparisons per die and was cut for this iteration.
    uint8 private constant FACE_COUNT = 6;

    enum Phase {
        Lobby,
        InProgress,
        ChallengePending,
        RevealPending,
        Ended
    }

    struct Bid {
        uint8 quantity;
        uint8 face;
        address bidder;
    }

    struct Table {
        address host;
        uint8 maxPlayers;
        uint8 turnIdx;
        Phase phase;
        bool hasBid;
        uint256 roundNumber;
        address[] players;
        Bid currentBid;
        address pendingChallenger;
        ebool pendingVerdict;
        address winner;
    }

    uint256 public nextTableId;

    mapping(uint256 => Table) private _tables;
    mapping(uint256 => mapping(address => euint8[5])) internal _hands;
    mapping(uint256 => mapping(address => bool)) public isPlayerAt;
    mapping(uint256 => mapping(address => bool)) public eliminated;
    /// @dev Real Liar's Dice: losing a challenge costs the loser one die, not the game --
    ///      they keep playing (with a smaller hand) until this hits 0, only then are they
    ///      `eliminated`. Starts at DICE_PER_PLAYER on join, only ever decreases.
    mapping(uint256 => mapping(address => uint8)) public diceCount;
    mapping(uint256 => Bid[]) private _bidHistory;
    /// @dev The players who were active for the round just challenged, captured before
    ///      the loser is marked eliminated -- so the loser's hand is still included in
    ///      that round's reveal (proving the verdict), even though they're now out.
    mapping(uint256 => address[]) private _pendingReveal;
    /// @dev Snapshot of each pending-reveal player's hand size *as rolled this round*,
    ///      taken before the loser's `diceCount` is decremented -- {_finalizeReveal} needs
    ///      the count dice were actually rolled at, not whatever `diceCount` reads by the
    ///      time reveal is submitted (which, for the loser, is already one less).
    mapping(uint256 => mapping(address => uint8)) private _pendingRevealDiceCount;

    /// @dev Casual-mode scoreboard: 1 point per table won, tracked globally (not
    ///      per-table) so a player's score accumulates across every table they've played.
    ///      `_allPlayers`/`_isKnownPlayer` register every address that has ever joined a
    ///      table (win or not), so {getAllPlayerPoints} can return a complete leaderboard
    ///      -- including 0-point entries -- rather than only ever-winners, and so external
    ///      tooling doesn't have to reconstruct the player set from event logs itself.
    mapping(address => uint256) private _points;
    address[] private _allPlayers;
    mapping(address => bool) private _isKnownPlayer;

    event TableCreated(uint256 indexed tableId, address indexed host, uint8 maxPlayers);
    event PlayerJoined(uint256 indexed tableId, address indexed player);
    event GameStarted(uint256 indexed tableId, address[] players);
    event RoundStarted(uint256 indexed tableId, uint256 indexed roundNumber, address[] activePlayers);
    event BidPlaced(uint256 indexed tableId, address indexed player, uint8 quantity, uint8 face);
    event ChallengeCalled(
        uint256 indexed tableId, address indexed challenger, address indexed bidder, uint8 quantity, uint8 face
    );
    event VerdictRevealed(uint256 indexed tableId, bool bidWasGood, address loser);
    event PlayerEliminated(uint256 indexed tableId, address indexed player);
    event HandsRevealed(uint256 indexed tableId, address[] players, uint8[][] dice);
    event TableEnded(uint256 indexed tableId, address winner);
    event PointsAwarded(address indexed player, uint256 newTotal);

    error InvalidPlayerCount(uint8 maxPlayers);
    error TableNotInLobby();
    error TableFull();
    error AlreadyJoined();
    error NotHost();
    error NotEnoughPlayers();
    error NotInProgress();
    error NotYourTurn();
    error PlayerEliminatedError();
    error InvalidFace(uint8 face);
    error InvalidQuantity();
    error MustEscalateBid();
    error NoActiveBid();
    error NoPendingChallenge();
    error VerdictNotReady();
    error NoPendingReveal();
    error RevealNotReady();
    error NotAPlayer();

    /// @notice Create a new casual table. The creator automatically joins as the first player.
    function createTable(uint8 maxPlayers) external returns (uint256 tableId) {
        if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) revert InvalidPlayerCount(maxPlayers);

        tableId = nextTableId++;
        Table storage t = _tables[tableId];
        t.host = msg.sender;
        t.maxPlayers = maxPlayers;
        t.phase = Phase.Lobby;

        emit TableCreated(tableId, msg.sender, maxPlayers);
        _join(tableId, msg.sender);
    }

    /// @notice Join an open casual table.
    function joinTable(uint256 tableId) external {
        Table storage t = _tables[tableId];
        if (t.phase != Phase.Lobby) revert TableNotInLobby();
        if (t.players.length >= t.maxPlayers) revert TableFull();
        if (isPlayerAt[tableId][msg.sender]) revert AlreadyJoined();

        _join(tableId, msg.sender);
    }

    /// @notice Host starts the game once at least two players have joined. Rolls every
    ///         player's first encrypted hand and seals each die to its owner only.
    function startGame(uint256 tableId) external {
        Table storage t = _tables[tableId];
        if (msg.sender != t.host) revert NotHost();
        if (t.phase != Phase.Lobby) revert TableNotInLobby();
        if (t.players.length < MIN_PLAYERS) revert NotEnoughPlayers();

        emit GameStarted(tableId, t.players);
        _startRound(tableId);
    }

    /// @notice Place a public bid. Must escalate on the current bid: strictly higher
    ///         quantity, or the same quantity with a strictly higher face.
    function placeBid(uint256 tableId, uint8 quantity, uint8 face) external {
        Table storage t = _tables[tableId];
        _requireCurrentTurn(tableId, t);
        if (face < 1 || face > FACE_COUNT) revert InvalidFace(face);

        if (t.hasBid) {
            bool escalates = quantity > t.currentBid.quantity
                || (quantity == t.currentBid.quantity && face > t.currentBid.face);
            if (!escalates) revert MustEscalateBid();
        } else if (quantity < 1) {
            revert InvalidQuantity();
        }

        t.currentBid = Bid({quantity: quantity, face: face, bidder: msg.sender});
        t.hasBid = true;
        _bidHistory[tableId].push(t.currentBid);

        emit BidPlaced(tableId, msg.sender, quantity, face);
        _advanceTurn(tableId, t);
    }

    /// @notice Challenge the current bid. Homomorphically counts matching dice (including
    ///         wild ones) across every active player's encrypted hand, then requests
    ///         decryption of only the boolean "bid was good" verdict.
    function challenge(uint256 tableId) external {
        Table storage t = _tables[tableId];
        _requireCurrentTurn(tableId, t);
        if (!t.hasBid) revert NoActiveBid();

        euint8 total = _countMatches(tableId, t);
        ebool verdict = FHE.gte(total, FHE.asEuint8(t.currentBid.quantity));
        FHE.allowThis(verdict);
        _markDecryptable(verdict);

        t.pendingChallenger = msg.sender;
        t.pendingVerdict = verdict;
        t.phase = Phase.ChallengePending;

        emit ChallengeCalled(tableId, msg.sender, t.currentBid.bidder, t.currentBid.quantity, t.currentBid.face);
    }

    /// @notice Submit the verdict's decrypted value + Threshold Network signature (fetched
    ///         off-chain via `client.decryptForTx`) to apply it: the loser gives up one die
    ///         (eliminated only once that hits zero -- real Liar's Dice, not a single-loss
    ///         knockout) and every remaining active hand is marked publicly decryptable for
    ///         the end-of-round reveal. `FHE.publishDecryptResult` reverts on an invalid
    ///         signature, so a caller cannot lie about the verdict.
    function finalizeChallenge(uint256 tableId, bool verdictResult, bytes calldata signature) external {
        Table storage t = _tables[tableId];
        if (t.phase != Phase.ChallengePending) revert NoPendingChallenge();

        _publishResult(t.pendingVerdict, verdictResult, signature);
        (bool bidWasGood, bool ready) = FHE.getDecryptResultSafe(t.pendingVerdict);
        if (!ready) revert VerdictNotReady();

        address[] memory roundParticipants = _activePlayers(tableId, t);
        address loser = bidWasGood ? t.pendingChallenger : t.currentBid.bidder;

        emit VerdictRevealed(tableId, bidWasGood, loser);

        // Snapshot each participant's hand size *as rolled this round* before the loser's
        // diceCount changes below -- {_finalizeReveal} needs this exact count, not whatever
        // diceCount reads afterward.
        _pendingReveal[tableId] = roundParticipants;
        for (uint256 i = 0; i < roundParticipants.length; i++) {
            address p = roundParticipants[i];
            uint8 n = diceCount[tableId][p];
            _pendingRevealDiceCount[tableId][p] = n;
            for (uint8 d = 0; d < n; d++) {
                _markDecryptable(_hands[tableId][p][d]);
            }
        }

        uint8 remaining = diceCount[tableId][loser] - 1;
        diceCount[tableId][loser] = remaining;
        if (remaining == 0) {
            eliminated[tableId][loser] = true;
            emit PlayerEliminated(tableId, loser);
        }

        t.phase = Phase.RevealPending;
    }

    /// @notice Submit every pending hand's decrypted value + signature (fetched off-chain,
    ///         one `decryptForTx` per die, in the same `players -> dice[0..5)` order as
    ///         {getPendingRevealHandles}) to publish the round's hands. With more than one
    ///         player left, rolls fresh hands and starts a new round; otherwise ends the
    ///         table and crowns the sole remaining player the winner.
    function revealAfterElimination(uint256 tableId, uint8[] calldata results, bytes[] calldata signatures)
        external
    {
        _finalizeReveal(tableId, results, signatures);
    }

    /// @notice Alias of {revealAfterElimination} kept for interface clarity with callers
    ///         that expect a "finalize" style name.
    function finalizeReveal(uint256 tableId, uint8[] calldata results, bytes[] calldata signatures) external {
        _finalizeReveal(tableId, results, signatures);
    }

    function _finalizeReveal(uint256 tableId, uint8[] calldata results, bytes[] calldata signatures) internal {
        Table storage t = _tables[tableId];
        if (t.phase != Phase.RevealPending) revert NoPendingReveal();

        address[] memory participants = _pendingReveal[tableId];

        uint256 totalDice = 0;
        for (uint256 i = 0; i < participants.length; i++) {
            totalDice += _pendingRevealDiceCount[tableId][participants[i]];
        }
        if (results.length != totalDice || results.length != signatures.length) {
            revert RevealNotReady();
        }

        uint8[][] memory dice = new uint8[][](participants.length);
        uint256 k = 0;
        for (uint256 i = 0; i < participants.length; i++) {
            (dice[i], k) = _revealPlayerHand(tableId, participants[i], results, signatures, k);
        }

        emit HandsRevealed(tableId, participants, dice);
        delete _pendingReveal[tableId];

        address[] memory stillActive = _activePlayers(tableId, t);
        if (stillActive.length <= 1) {
            t.phase = Phase.Ended;
            t.winner = stillActive.length == 1 ? stillActive[0] : address(0);
            emit TableEnded(tableId, t.winner);

            if (t.winner != address(0)) {
                uint256 newTotal = ++_points[t.winner];
                emit PointsAwarded(t.winner, newTotal);
            }
        } else {
            _startRound(tableId);
        }
    }

    /// @dev Publishes and decrypts one participant's hand out of `results`/`signatures`
    ///      starting at `startIdx`, returning that hand plus the next unused index. Split
    ///      out of {_finalizeReveal} purely to keep that function's local-variable count
    ///      under the EVM's stack-depth limit -- `uint8[][] memory` reveal handling needs
    ///      more locals alive at once than the old fixed `uint8[5][]` version did.
    function _revealPlayerHand(
        uint256 tableId,
        address player,
        uint8[] calldata results,
        bytes[] calldata signatures,
        uint256 startIdx
    ) internal returns (uint8[] memory playerDice, uint256 nextIdx) {
        uint8 n = _pendingRevealDiceCount[tableId][player];
        playerDice = new uint8[](n);
        nextIdx = startIdx;
        for (uint8 d = 0; d < n; d++) {
            euint8 handle = _hands[tableId][player][d];
            _publishResult(handle, results[nextIdx], signatures[nextIdx]);
            (uint8 val, bool ready) = FHE.getDecryptResultSafe(handle);
            if (!ready) revert RevealNotReady();
            playerDice[d] = val;
            nextIdx++;
        }
        delete _pendingRevealDiceCount[tableId][player];
    }

    // ----------------------------------------------------------------------
    // Views
    // ----------------------------------------------------------------------

    function getTable(uint256 tableId)
        external
        view
        returns (
            address host,
            uint8 maxPlayers,
            Phase phase,
            uint256 roundNumber,
            address[] memory players,
            bool[] memory eliminatedFlags,
            uint8 turnIdx,
            Bid memory currentBid,
            bool hasBid,
            address winner
        )
    {
        Table storage t = _tables[tableId];
        bool[] memory flags = new bool[](t.players.length);
        for (uint256 i = 0; i < t.players.length; i++) {
            flags[i] = eliminated[tableId][t.players[i]];
        }
        return (
            t.host,
            t.maxPlayers,
            t.phase,
            t.roundNumber,
            t.players,
            flags,
            t.turnIdx,
            t.currentBid,
            t.hasBid,
            t.winner
        );
    }

    /// @notice The pending challenge verdict's ciphertext handle, once `challenge()` has
    ///         been called -- the frontend feeds this into `decryptForTx` to fetch the
    ///         plaintext + signature `finalizeChallenge` needs. Reverts if there's no
    ///         pending challenge, since the handle is meaningless otherwise.
    function getPendingVerdictHandle(uint256 tableId) external view returns (ebool) {
        Table storage t = _tables[tableId];
        if (t.phase != Phase.ChallengePending) revert NoPendingChallenge();
        return t.pendingVerdict;
    }

    /// @notice The ciphertext handles pending reveal after a challenge resolves, in the
    ///         exact `players[i].dice[d]` order `finalizeReveal`'s `results`/`signatures`
    ///         arrays must match.
    function getPendingRevealHandles(uint256 tableId)
        external
        view
        returns (address[] memory players, euint8[][] memory handles)
    {
        players = _pendingReveal[tableId];
        handles = new euint8[][](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            address p = players[i];
            uint8 n = _pendingRevealDiceCount[tableId][p];
            euint8[] memory h = new euint8[](n);
            for (uint8 d = 0; d < n; d++) {
                h[d] = _hands[tableId][p][d];
            }
            handles[i] = h;
        }
    }

    function getBidHistory(uint256 tableId) external view returns (Bid[] memory) {
        return _bidHistory[tableId];
    }

    function getActivePlayers(uint256 tableId) external view returns (address[] memory) {
        return _activePlayers(tableId, _tables[tableId]);
    }

    /// @notice Returns the caller's own encrypted dice handles for this table so the
    ///         frontend can unseal them client-side with cofhejs. No other address can
    ///         read another player's hand -- the FHE access control only ever grants the
    ///         owning address and this contract permission to operate on these handles.
    function getMyDiceHandles(uint256 tableId) external view returns (euint8[] memory handles) {
        if (!isPlayerAt[tableId][msg.sender]) revert NotAPlayer();
        uint8 n = diceCount[tableId][msg.sender];
        handles = new euint8[](n);
        for (uint8 d = 0; d < n; d++) {
            handles[d] = _hands[tableId][msg.sender][d];
        }
    }

    /// @notice Casual-mode win count for a single address -- 1 point per table won,
    ///         accumulated across every table that address has played. Returns 0 for an
    ///         address that has never won (including one that's never played at all).
    function getPoints(address player) external view returns (uint256) {
        return _points[player];
    }

    /// @notice The full scoreboard: every address that has ever joined a table, paired
    ///         with its current point total (0 for anyone who hasn't won yet). `players[i]`
    ///         and `pointsList[i]` refer to the same address. Intended for building a
    ///         leaderboard/score-tracking UI without replaying event logs -- this is a
    ///         casual-mode MVP, so the full list is returned unpaginated; see
    ///         {getPlayerCount} if the list needs to be split up by an external caller.
    function getAllPlayerPoints() external view returns (address[] memory players, uint256[] memory pointsList) {
        players = _allPlayers;
        pointsList = new uint256[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            pointsList[i] = _points[players[i]];
        }
    }

    /// @notice How many distinct addresses have ever joined a table -- the length of the
    ///         arrays {getAllPlayerPoints} returns.
    function getPlayerCount() external view returns (uint256) {
        return _allPlayers.length;
    }

    // ----------------------------------------------------------------------
    // Internal helpers
    // ----------------------------------------------------------------------

    function _join(uint256 tableId, address player) internal {
        _tables[tableId].players.push(player);
        isPlayerAt[tableId][player] = true;
        diceCount[tableId][player] = DICE_PER_PLAYER;
        emit PlayerJoined(tableId, player);

        if (!_isKnownPlayer[player]) {
            _isKnownPlayer[player] = true;
            _allPlayers.push(player);
        }
    }

    function _requireCurrentTurn(uint256 tableId, Table storage t) internal view {
        if (t.phase != Phase.InProgress) revert NotInProgress();
        if (eliminated[tableId][msg.sender]) revert PlayerEliminatedError();
        if (t.players[t.turnIdx] != msg.sender) revert NotYourTurn();
    }

    function _advanceTurn(uint256 tableId, Table storage t) internal {
        uint256 n = t.players.length;
        uint256 idx = t.turnIdx;
        for (uint256 k = 0; k < n; k++) {
            idx = (idx + 1) % n;
            if (!eliminated[tableId][t.players[idx]]) {
                // forge-lint: disable-next-line(unsafe-typecast)
                // safe: idx < t.players.length <= MAX_PLAYERS (8)
                t.turnIdx = uint8(idx);
                return;
            }
        }
    }

    function _activePlayers(uint256 tableId, Table storage t) internal view returns (address[] memory active) {
        uint256 n = t.players.length;
        uint256 count;
        for (uint256 i = 0; i < n; i++) {
            if (!eliminated[tableId][t.players[i]]) count++;
        }
        active = new address[](count);
        uint256 j;
        for (uint256 i = 0; i < n; i++) {
            if (!eliminated[tableId][t.players[i]]) {
                active[j++] = t.players[i];
            }
        }
    }

    function _startRound(uint256 tableId) internal {
        Table storage t = _tables[tableId];
        t.roundNumber += 1;
        t.hasBid = false;
        t.currentBid = Bid({quantity: 0, face: 0, bidder: address(0)});
        t.phase = Phase.InProgress;

        address[] memory active = _activePlayers(tableId, t);
        for (uint256 i = 0; i < active.length; i++) {
            _rollHand(tableId, active[i]);
        }

        for (uint256 i = 0; i < t.players.length; i++) {
            if (!eliminated[tableId][t.players[i]]) {
                // forge-lint: disable-next-line(unsafe-typecast)
                // safe: i < t.players.length <= MAX_PLAYERS (8)
                t.turnIdx = uint8(i);
                break;
            }
        }

        emit RoundStarted(tableId, t.roundNumber, active);
    }

    /// @dev Rolls exactly `diceCount[tableId][player]` dice -- not always DICE_PER_PLAYER --
    ///      so a player who's lost dice in earlier rounds rolls a correspondingly smaller
    ///      hand, matching a real Liar's Dice cup with fewer dice in it.
    function _rollHand(uint256 tableId, address player) internal virtual {
        uint8 n = diceCount[tableId][player];
        for (uint8 i = 0; i < n; i++) {
            euint8 raw = FHE.randomEuint8();
            euint8 face = FHE.add(FHE.rem(raw, FHE.asEuint8(FACE_COUNT)), FHE.asEuint8(1));
            FHE.allowThis(face);
            FHE.allow(face, player);
            _hands[tableId][player][i] = face;
        }
    }

    /// @dev Marks a ciphertext publicly decryptable. `virtual` purely so the test harness
    ///      can additionally fulfill it immediately against the mock coprocessor (started
    ///      here rather than in `_publishResult` below, so the mock's simulated async delay
    ///      has elapsed by the time a later transaction reads the result -- matching how
    ///      the real flow's off-chain fetch happens between these two on-chain steps too).
    function _markDecryptable(ebool v) internal virtual {
        FHE.allowPublic(v);
    }

    function _markDecryptable(euint8 v) internal virtual {
        FHE.allowPublic(v);
    }

    /// @dev Submits a caller-fetched decrypt result. `virtual` purely so the test harness
    ///      can no-op this (the mock coprocessor has no `FHE.publishDecryptResult`
    ///      implementation at all, and doesn't need one -- see `_markDecryptable` above and
    ///      test/harness/TestableFheLiarsDice.sol).
    function _publishResult(ebool handle, bool result, bytes calldata signature) internal virtual {
        FHE.publishDecryptResult(handle, result, signature);
    }

    function _publishResult(euint8 handle, uint8 result, bytes calldata signature) internal virtual {
        FHE.publishDecryptResult(handle, result, signature);
    }

    /// @dev Sums, across every active player's hand, dice equal to the challenged face --
    ///      plus wild `1`s when the challenged face itself isn't 1 -- entirely over
    ///      encrypted values. The plaintext running total never touches storage or an
    ///      event; only its `>= bidQuantity` comparison is ever decrypted.
    function _countMatches(uint256 tableId, Table storage t) internal returns (euint8 total) {
        euint8 faceEnc = FHE.asEuint8(t.currentBid.face);
        euint8 oneEnc = FHE.asEuint8(WILD_FACE);
        euint8 one = FHE.asEuint8(1);
        euint8 zero = FHE.asEuint8(0);
        bool faceIsWild = t.currentBid.face == WILD_FACE;

        total = zero;
        for (uint256 i = 0; i < t.players.length; i++) {
            address p = t.players[i];
            if (eliminated[tableId][p]) continue;
            for (uint8 d = 0; d < diceCount[tableId][p]; d++) {
                euint8 die = _hands[tableId][p][d];
                ebool isMatch = faceIsWild ? FHE.eq(die, faceEnc) : FHE.or(FHE.eq(die, faceEnc), FHE.eq(die, oneEnc));
                total = FHE.add(total, FHE.select(isMatch, one, zero));
            }
        }
        FHE.allowThis(total);
    }
}
