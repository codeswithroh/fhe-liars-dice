// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {FHE, ebool, euint8} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @notice The only piece of the previous deployment this contract reads: its point totals.
interface ILegacyPoints {
    function getPoints(address player) external view returns (uint256);
}

/// @title FheLiarsDice
/// @notice Casual-mode Liar's Dice with encrypted per-player hands on Fhenix CoFHE 1.0.
///         Dice are generated and stored encrypted on-chain. Bids are public. A challenge
///         reveals only whether the bid was good or a lie, computed homomorphically over every
///         active player's encrypted hand. Hands are decrypted after each challenge resolves,
///         matching a physical Liar's Dice showdown.
/// @dev Decryption follows CoFHE 1.0's flow: the contract marks a ciphertext with
///      `FHE.allowPublic`, an off-chain client fetches the plaintext plus a Threshold Network
///      signature via `client.decryptForTx(ctHash).withoutACP().execute()`, and anyone submits
///      both back through `finalizeChallenge` / `finalizeReveal`, where
///      `FHE.publishDecryptResult` verifies the signature before accepting it.
///
///      The external interface is a superset of the previous deployment (cofhe-contracts 0.x),
///      so the existing frontend works unchanged. Additions: `VERSION`, an on-chain top-N
///      leaderboard (`getLeaderboard`), a paginated scoreboard (`getPlayerPoints`), and
///      trustless carry-over of the previous deployment's points (`syncLegacyPoints`).
contract FheLiarsDice {
    string public constant VERSION = "1.0.1";

    uint8 public constant DICE_PER_PLAYER = 5;
    uint8 public constant WILD_FACE = 1;
    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 8;
    /// @notice How many top scorers {getLeaderboard} keeps sorted on-chain.
    uint256 public constant LEADERBOARD_SIZE = 50;
    /// @dev FHE.randomEuint8() % 6 has a slight modulo bias (256 isn't divisible by 6): faces
    ///      1-4 are drawn ~0.4% more often than faces 5-6. Acceptable for casual mode; a
    ///      bias-free rejection-sampling scheme would need several encrypted comparisons per die.
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

    /// @notice Previous deployment whose points carry over (address(0) disables carry-over).
    ILegacyPoints public immutable legacy;

    uint256 public nextTableId;

    mapping(uint256 => Table) private _tables;
    mapping(uint256 => mapping(address => euint8[5])) internal _hands;
    mapping(uint256 => mapping(address => bool)) public isPlayerAt;
    mapping(uint256 => mapping(address => bool)) public eliminated;
    /// @dev Losing a challenge costs one die; a player is `eliminated` only once this hits 0.
    mapping(uint256 => mapping(address => uint8)) public diceCount;
    mapping(uint256 => Bid[]) private _bidHistory;
    /// @dev Players active in the round just challenged, captured before the loser can be
    ///      eliminated so the loser's hand is still part of that round's reveal.
    mapping(uint256 => address[]) private _pendingReveal;
    /// @dev Each pending-reveal player's hand size as rolled this round, taken before the
    ///      loser's `diceCount` is decremented.
    mapping(uint256 => mapping(address => uint8)) private _pendingRevealDiceCount;

    /// @dev Scoreboard: 1 point per table won, global across tables. `_allPlayers` registers
    ///      every address that has joined a table or carried points over.
    mapping(address => uint256) internal _points;
    address[] private _allPlayers;
    mapping(address => bool) private _isKnownPlayer;
    mapping(address => bool) public legacySynced;

    /// @dev Top scorers, sorted by points descending (ties keep whoever got there first).
    address[] private _top;
    /// @dev 1-based position in `_top`; 0 means not on the leaderboard.
    mapping(address => uint256) private _topPos;

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
    event LegacyPointsSynced(address indexed player, uint256 legacyPoints, uint256 newTotal);

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

    constructor(address legacyPoints) {
        legacy = ILegacyPoints(legacyPoints);
    }

    // ----------------------------------------------------------------------
    // Lobby
    // ----------------------------------------------------------------------

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

    // ----------------------------------------------------------------------
    // Play
    // ----------------------------------------------------------------------

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
    ///         wild ones) across every active player's encrypted hand and marks only the
    ///         boolean "bid was good" verdict for public decryption.
    function challenge(uint256 tableId) external {
        Table storage t = _tables[tableId];
        _requireCurrentTurn(tableId, t);
        if (!t.hasBid) revert NoActiveBid();

        euint8 total = _countMatches(tableId, t);
        ebool verdict = FHE.gte(total, FHE.asEuint8(t.currentBid.quantity));
        FHE.allowThis(verdict);
        FHE.allowPublic(verdict);

        t.pendingChallenger = msg.sender;
        t.pendingVerdict = verdict;
        t.phase = Phase.ChallengePending;

        emit ChallengeCalled(tableId, msg.sender, t.currentBid.bidder, t.currentBid.quantity, t.currentBid.face);
    }

    /// @notice Submit the verdict's plaintext + Threshold Network signature (from
    ///         `decryptForTx`). The loser gives up one die (eliminated at zero) and every hand
    ///         from this round is marked publicly decryptable for the reveal.
    ///         `FHE.publishDecryptResult` reverts on a bad signature, so nobody can lie about
    ///         the verdict.
    function finalizeChallenge(uint256 tableId, bool verdictResult, bytes calldata signature) external {
        Table storage t = _tables[tableId];
        if (t.phase != Phase.ChallengePending) revert NoPendingChallenge();

        FHE.publishDecryptResult(t.pendingVerdict, verdictResult, signature);
        (bool bidWasGood, bool ready) = FHE.getDecryptResultSafe(t.pendingVerdict);
        if (!ready) revert VerdictNotReady();

        address[] memory roundParticipants = _activePlayers(tableId, t);
        address loser = bidWasGood ? t.pendingChallenger : t.currentBid.bidder;

        emit VerdictRevealed(tableId, bidWasGood, loser);

        _pendingReveal[tableId] = roundParticipants;
        for (uint256 i = 0; i < roundParticipants.length; i++) {
            address p = roundParticipants[i];
            uint8 n = diceCount[tableId][p];
            _pendingRevealDiceCount[tableId][p] = n;
            for (uint8 d = 0; d < n; d++) {
                FHE.allowPublic(_hands[tableId][p][d]);
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

    /// @notice Submit every pending die's plaintext + signature, in the
    ///         `players -> dice` order of {getPendingRevealHandles}. Publishes the round's
    ///         hands, then either starts a new round or ends the table and awards the winner
    ///         one point.
    function finalizeReveal(uint256 tableId, uint8[] calldata results, bytes[] calldata signatures) external {
        _finalizeReveal(tableId, results, signatures);
    }

    /// @notice Alias of {finalizeReveal}, kept for interface compatibility.
    function revealAfterElimination(uint256 tableId, uint8[] calldata results, bytes[] calldata signatures)
        external
    {
        _finalizeReveal(tableId, results, signatures);
    }

    // ----------------------------------------------------------------------
    // Points & leaderboard
    // ----------------------------------------------------------------------

    /// @notice Pull points earned on the previous deployment for `players`. Permissionless
    ///         and idempotent: the amount is read on-chain from `legacy`, so callers can't
    ///         influence it, and each address is imported at most once. Players are also
    ///         synced automatically the first time they join a table here.
    function syncLegacyPoints(address[] calldata players) external {
        for (uint256 i = 0; i < players.length; i++) {
            _syncLegacy(players[i]);
        }
    }

    /// @notice Games won by `player`, including points from the previous deployment that
    ///         haven't been synced yet.
    function getPoints(address player) external view returns (uint256) {
        return _points[player] + (legacySynced[player] ? 0 : _legacyPointsOf(player));
    }

    /// @notice Top scorers by points, highest first (at most LEADERBOARD_SIZE entries).
    ///         Bounded and pre-sorted, so it stays cheap regardless of how many people play.
    function getLeaderboard() external view returns (address[] memory players, uint256[] memory pointsList) {
        players = _top;
        pointsList = new uint256[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            pointsList[i] = _points[players[i]];
        }
    }

    /// @notice 1-based leaderboard position of `player`, or 0 if outside the top LEADERBOARD_SIZE.
    function getLeaderboardRank(address player) external view returns (uint256) {
        return _topPos[player];
    }

    /// @notice One page of the full scoreboard, in registration order.
    function getPlayerPoints(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory players, uint256[] memory pointsList)
    {
        uint256 total = _allPlayers.length;
        uint256 end = offset >= total ? offset : (limit > total - offset ? total : offset + limit);
        players = new address[](end - offset);
        pointsList = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            players[i - offset] = _allPlayers[i];
            pointsList[i - offset] = _points[_allPlayers[i]];
        }
    }

    /// @notice The full, unpaginated scoreboard. Kept for interface compatibility; its cost
    ///         grows with every player, so use {getLeaderboard} or {getPlayerPoints} instead.
    function getAllPlayerPoints() external view returns (address[] memory players, uint256[] memory pointsList) {
        players = _allPlayers;
        pointsList = new uint256[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            pointsList[i] = _points[players[i]];
        }
    }

    /// @notice Number of distinct addresses on the scoreboard.
    function getPlayerCount() external view returns (uint256) {
        return _allPlayers.length;
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
            t.host, t.maxPlayers, t.phase, t.roundNumber, t.players, flags, t.turnIdx, t.currentBid, t.hasBid, t.winner
        );
    }

    /// @notice The pending challenge verdict's ciphertext handle, to feed into `decryptForTx`.
    function getPendingVerdictHandle(uint256 tableId) external view returns (ebool) {
        Table storage t = _tables[tableId];
        if (t.phase != Phase.ChallengePending) revert NoPendingChallenge();
        return t.pendingVerdict;
    }

    /// @notice Ciphertext handles pending reveal, in the exact order `finalizeReveal` expects.
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

    /// @notice The caller's own encrypted dice handles. Only the owner (and this contract) is
    ///         allowed to decrypt them; call with `from`/`account` set to the player.
    function getMyDiceHandles(uint256 tableId) external view returns (euint8[] memory handles) {
        if (!isPlayerAt[tableId][msg.sender]) revert NotAPlayer();
        uint8 n = diceCount[tableId][msg.sender];
        handles = new euint8[](n);
        for (uint8 d = 0; d < n; d++) {
            handles[d] = _hands[tableId][msg.sender][d];
        }
    }

    // ----------------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------------

    function _finalizeReveal(uint256 tableId, uint8[] calldata results, bytes[] calldata signatures) internal {
        Table storage t = _tables[tableId];
        if (t.phase != Phase.RevealPending) revert NoPendingReveal();

        address[] memory participants = _pendingReveal[tableId];

        uint256 totalDice = 0;
        for (uint256 i = 0; i < participants.length; i++) {
            totalDice += _pendingRevealDiceCount[tableId][participants[i]];
        }
        if (results.length != totalDice || results.length != signatures.length) revert RevealNotReady();

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
                _updateLeaderboard(t.winner);
                emit PointsAwarded(t.winner, newTotal);
            }
        } else {
            _startRound(tableId);
        }
    }

    /// @dev Publishes and decrypts one participant's hand out of `results`/`signatures`
    ///      starting at `startIdx`; split out to stay under the stack-depth limit.
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
            FHE.publishDecryptResult(handle, results[nextIdx], signatures[nextIdx]);
            (uint8 val, bool ready) = FHE.getDecryptResultSafe(handle);
            if (!ready) revert RevealNotReady();
            playerDice[d] = val;
            nextIdx++;
        }
        delete _pendingRevealDiceCount[tableId][player];
    }

    function _join(uint256 tableId, address player) internal {
        _tables[tableId].players.push(player);
        isPlayerAt[tableId][player] = true;
        diceCount[tableId][player] = DICE_PER_PLAYER;
        emit PlayerJoined(tableId, player);

        _register(player);
        _syncLegacy(player);
    }

    function _register(address player) internal {
        if (!_isKnownPlayer[player]) {
            _isKnownPlayer[player] = true;
            _allPlayers.push(player);
        }
    }

    function _syncLegacy(address player) internal {
        if (legacySynced[player]) return;
        legacySynced[player] = true;
        uint256 carried = _legacyPointsOf(player);
        if (carried == 0) return;

        uint256 newTotal = _points[player] + carried;
        _points[player] = newTotal;
        _register(player);
        _updateLeaderboard(player);
        emit LegacyPointsSynced(player, carried, newTotal);
    }

    /// @dev Never reverts: a missing or misbehaving legacy contract just means no carry-over.
    function _legacyPointsOf(address player) internal view returns (uint256) {
        if (address(legacy) == address(0)) return 0;
        try legacy.getPoints(player) returns (uint256 p) {
            return p;
        } catch {
            return 0;
        }
    }

    /// @dev Points only ever increase, so a player can only move up: insert (or replace the
    ///      last entry) if they now qualify, then bubble up. O(LEADERBOARD_SIZE) worst case.
    function _updateLeaderboard(address player) internal {
        uint256 pts = _points[player];
        uint256 pos = _topPos[player];
        if (pos == 0) {
            if (_top.length < LEADERBOARD_SIZE) {
                _top.push(player);
            } else {
                address last = _top[_top.length - 1];
                if (pts <= _points[last]) return;
                _topPos[last] = 0;
                _top[_top.length - 1] = player;
            }
            pos = _top.length;
            _topPos[player] = pos;
        }
        while (pos > 1) {
            address above = _top[pos - 2];
            if (_points[above] >= pts) break;
            _top[pos - 2] = player;
            _top[pos - 1] = above;
            _topPos[above] = pos;
            pos--;
        }
        _topPos[player] = pos;
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
            if (!eliminated[tableId][t.players[i]]) active[j++] = t.players[i];
        }
    }

    function _startRound(uint256 tableId) internal {
        Table storage t = _tables[tableId];
        t.roundNumber += 1;
        t.hasBid = false;
        t.currentBid = Bid({quantity: 0, face: 0, bidder: address(0)});
        t.phase = Phase.InProgress;

        address[] memory active = _activePlayers(tableId, t);
        euint8 faceCount = FHE.asEuint8(FACE_COUNT);
        euint8 one = FHE.asEuint8(1);
        for (uint256 i = 0; i < active.length; i++) {
            _rollHand(tableId, active[i], faceCount, one);
        }

        for (uint256 i = 0; i < t.players.length; i++) {
            if (!eliminated[tableId][t.players[i]]) {
                // safe: i < t.players.length <= MAX_PLAYERS (8)
                t.turnIdx = uint8(i);
                break;
            }
        }

        emit RoundStarted(tableId, t.roundNumber, active);
    }

    /// @dev Rolls exactly `diceCount` dice, so a player who has lost dice rolls a smaller hand.
    function _rollHand(uint256 tableId, address player, euint8 faceCount, euint8 one) internal {
        uint8 n = diceCount[tableId][player];
        for (uint8 i = 0; i < n; i++) {
            euint8 face = FHE.add(FHE.rem(FHE.randomEuint8(), faceCount), one);
            FHE.allowThis(face);
            FHE.allow(face, player);
            _hands[tableId][player][i] = face;
        }
    }

    /// @dev Sums dice equal to the challenged face (plus wild ones unless the face is 1)
    ///      across every active hand, entirely over encrypted values.
    function _countMatches(uint256 tableId, Table storage t) internal returns (euint8 total) {
        euint8 faceEnc = FHE.asEuint8(t.currentBid.face);
        euint8 wildEnc = FHE.asEuint8(WILD_FACE);
        euint8 one = FHE.asEuint8(1);
        euint8 zero = FHE.asEuint8(0);
        bool faceIsWild = t.currentBid.face == WILD_FACE;

        total = zero;
        for (uint256 i = 0; i < t.players.length; i++) {
            address p = t.players[i];
            if (eliminated[tableId][p]) continue;
            for (uint8 d = 0; d < diceCount[tableId][p]; d++) {
                euint8 die = _hands[tableId][p][d];
                ebool isMatch = faceIsWild ? FHE.eq(die, faceEnc) : FHE.or(FHE.eq(die, faceEnc), FHE.eq(die, wildEnc));
                total = FHE.add(total, FHE.select(isMatch, one, zero));
            }
        }
        FHE.allowThis(total);
    }
}
