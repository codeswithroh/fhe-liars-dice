// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint8, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title FHE Liar's Dice (casual mode)
/// @notice Dice are rolled as encrypted CoFHE random values. Each player can decrypt only their own hand.
///         A challenge counts matching dice (ones are wild) across all sealed hands and makes only the
///         boolean verdict public. Anyone publishes the threshold-network-signed verdict to settle the round.
contract LiarsDice {
    string public constant VERSION = "1.0.1";

    uint8 public constant DICE_PER_PLAYER = 5;
    uint8 public constant MAX_PLAYERS = 6;
    uint8 public constant WILD_FACE = 1;

    enum Phase {
        None,
        Lobby,
        Rolling,
        Bidding,
        Resolving,
        Finished
    }

    struct Room {
        address host;
        Phase phase;
        uint32 round;
        uint8 turn; // index into players of whoever acts next
        uint8 bidQuantity;
        uint8 bidFace;
        uint8 bidder; // index of the player who made the standing bid
        uint8 challenger; // index of the player who called the bluff
        uint8 rolledCount; // alive players who rolled this round
        address winner;
        ebool verdict; // encrypted "bid was good" for the pending challenge
        address[] players;
    }

    uint256 public roomCount;
    mapping(uint256 => Room) private rooms;
    mapping(uint256 => mapping(address => uint8)) public diceLeft;
    mapping(uint256 => mapping(address => uint32)) public rolledRound;
    mapping(uint256 => mapping(address => euint8[])) private hands;

    event RoomCreated(uint256 indexed roomId, address indexed host);
    event PlayerJoined(uint256 indexed roomId, address indexed player);
    event RoundStarted(uint256 indexed roomId, uint32 round, address firstToAct);
    event DiceRolled(uint256 indexed roomId, uint32 round, address indexed player);
    event BidPlaced(uint256 indexed roomId, address indexed player, uint8 quantity, uint8 face);
    event ChallengeCalled(uint256 indexed roomId, address indexed challenger, address indexed bidder, bytes32 verdictHandle);
    event ChallengeResolved(uint256 indexed roomId, bool bidWasGood, address indexed loser, uint8 loserDiceLeft);
    event PlayerEliminated(uint256 indexed roomId, address indexed player);
    event GameFinished(uint256 indexed roomId, address indexed winner);

    error WrongPhase(Phase expected, Phase actual);
    error NotHost();
    error NotPlayer();
    error NotYourTurn();
    error RoomFull();
    error AlreadyJoined();
    error NotEnoughPlayers();
    error AlreadyRolled();
    error InvalidBid();
    error NoBidToChallenge();

    modifier inPhase(uint256 roomId, Phase expected) {
        Phase actual = rooms[roomId].phase;
        if (actual != expected) revert WrongPhase(expected, actual);
        _;
    }

    // ---------------------------------------------------------------- lobby

    function createRoom() external returns (uint256 roomId) {
        roomId = ++roomCount;
        Room storage room = rooms[roomId];
        room.host = msg.sender;
        room.phase = Phase.Lobby;
        room.players.push(msg.sender);
        diceLeft[roomId][msg.sender] = DICE_PER_PLAYER;
        emit RoomCreated(roomId, msg.sender);
        emit PlayerJoined(roomId, msg.sender);
    }

    function joinRoom(uint256 roomId) external inPhase(roomId, Phase.Lobby) {
        Room storage room = rooms[roomId];
        if (room.players.length >= MAX_PLAYERS) revert RoomFull();
        if (diceLeft[roomId][msg.sender] != 0) revert AlreadyJoined();
        room.players.push(msg.sender);
        diceLeft[roomId][msg.sender] = DICE_PER_PLAYER;
        emit PlayerJoined(roomId, msg.sender);
    }

    function startGame(uint256 roomId) external inPhase(roomId, Phase.Lobby) {
        Room storage room = rooms[roomId];
        if (msg.sender != room.host) revert NotHost();
        if (room.players.length < 2) revert NotEnoughPlayers();
        _startRound(roomId, 0);
    }

    // ---------------------------------------------------------------- round

    /// @notice Shake the cup: roll your remaining dice as encrypted random faces 1..6.
    function rollDice(uint256 roomId) external inPhase(roomId, Phase.Rolling) {
        Room storage room = rooms[roomId];
        uint8 count = diceLeft[roomId][msg.sender];
        if (count == 0) revert NotPlayer();
        if (rolledRound[roomId][msg.sender] == room.round) revert AlreadyRolled();
        rolledRound[roomId][msg.sender] = room.round;

        euint8[] storage hand = hands[roomId][msg.sender];
        delete hands[roomId][msg.sender];
        euint8 six = FHE.asEuint8(6);
        euint8 one = FHE.asEuint8(1);
        for (uint8 i = 0; i < count; i++) {
            // Map a uniform byte to 1..6. 256 % 6 leaves a slight bias toward 1..4, acceptable for casual mode.
            euint8 face = FHE.add(FHE.rem(FHE.randomEuint8(), six), one);
            FHE.allowThis(face);
            FHE.allow(face, msg.sender);
            hand.push(face);
        }
        emit DiceRolled(roomId, room.round, msg.sender);

        if (++room.rolledCount == _aliveCount(roomId)) {
            room.phase = Phase.Bidding;
        }
    }

    function placeBid(uint256 roomId, uint8 quantity, uint8 face) external inPhase(roomId, Phase.Bidding) {
        Room storage room = rooms[roomId];
        if (room.players[room.turn] != msg.sender) revert NotYourTurn();
        if (face < 1 || face > 6 || quantity == 0 || quantity > _totalDice(roomId)) revert InvalidBid();
        if (room.bidQuantity != 0) {
            bool higher = quantity > room.bidQuantity || (quantity == room.bidQuantity && face > room.bidFace);
            if (!higher) revert InvalidBid();
        }
        room.bidQuantity = quantity;
        room.bidFace = face;
        room.bidder = room.turn;
        room.turn = _nextAlive(roomId, room.turn);
        emit BidPlaced(roomId, msg.sender, quantity, face);
    }

    /// @notice Call the standing bid a lie. Counts matches across all sealed hands under FHE and
    ///         marks only the boolean verdict for public decryption.
    function challenge(uint256 roomId) external inPhase(roomId, Phase.Bidding) {
        Room storage room = rooms[roomId];
        if (room.bidQuantity == 0) revert NoBidToChallenge();
        if (room.players[room.turn] != msg.sender) revert NotYourTurn();

        euint8 target = FHE.asEuint8(room.bidFace);
        euint8 wild = FHE.asEuint8(WILD_FACE);
        euint8 total = FHE.asEuint8(0);
        bool faceIsWild = room.bidFace == WILD_FACE;
        uint256 n = room.players.length;
        for (uint256 p = 0; p < n; p++) {
            address player = room.players[p];
            if (diceLeft[roomId][player] == 0) continue;
            euint8[] storage hand = hands[roomId][player];
            for (uint256 d = 0; d < hand.length; d++) {
                ebool hit = FHE.eq(hand[d], target);
                if (!faceIsWild) hit = FHE.or(hit, FHE.eq(hand[d], wild));
                total = FHE.add(total, FHE.asEuint8(hit));
            }
        }
        ebool verdict = FHE.gte(total, FHE.asEuint8(room.bidQuantity));
        FHE.allowThis(verdict);
        FHE.allowPublic(verdict);

        room.verdict = verdict;
        room.challenger = room.turn;
        room.phase = Phase.Resolving;
        emit ChallengeCalled(roomId, msg.sender, room.players[room.bidder], ebool.unwrap(verdict));
    }

    /// @notice Publish the threshold-network decryption of the verdict (from `decryptForTx`) and settle.
    function resolveChallenge(uint256 roomId, bool bidWasGood, bytes calldata signature)
        external
        inPhase(roomId, Phase.Resolving)
    {
        Room storage room = rooms[roomId];
        FHE.publishDecryptResult(room.verdict, bidWasGood, signature);

        uint8 loserIdx = bidWasGood ? room.challenger : room.bidder;
        address loser = room.players[loserIdx];
        uint8 left = --diceLeft[roomId][loser];
        emit ChallengeResolved(roomId, bidWasGood, loser, left);

        if (left == 0) {
            _revealHand(roomId, loser);
            emit PlayerEliminated(roomId, loser);
            if (_aliveCount(roomId) == 1) {
                address winner = room.players[_nextAlive(roomId, loserIdx)];
                room.winner = winner;
                room.phase = Phase.Finished;
                _revealHand(roomId, winner);
                emit GameFinished(roomId, winner);
                return;
            }
            _startRound(roomId, _nextAlive(roomId, loserIdx));
        } else {
            _startRound(roomId, loserIdx);
        }
    }

    // ---------------------------------------------------------------- views

    function getRoom(uint256 roomId)
        external
        view
        returns (
            address host,
            Phase phase,
            uint32 round,
            address currentTurn,
            uint8 bidQuantity,
            uint8 bidFace,
            address bidder,
            address winner,
            bytes32 verdictHandle,
            address[] memory players
        )
    {
        Room storage room = rooms[roomId];
        host = room.host;
        phase = room.phase;
        round = room.round;
        players = room.players;
        if (players.length > 0) currentTurn = players[room.turn];
        bidQuantity = room.bidQuantity;
        bidFace = room.bidFace;
        if (bidQuantity != 0) bidder = players[room.bidder];
        winner = room.winner;
        verdictHandle = ebool.unwrap(room.verdict);
    }

    /// @notice Encrypted die handles for a player. Only that player can decrypt them during play.
    function getHand(uint256 roomId, address player) external view returns (bytes32[] memory handles) {
        euint8[] storage hand = hands[roomId][player];
        handles = new bytes32[](hand.length);
        for (uint256 i = 0; i < hand.length; i++) handles[i] = euint8.unwrap(hand[i]);
    }

    function totalDice(uint256 roomId) external view returns (uint256) {
        return _totalDice(roomId);
    }

    // ---------------------------------------------------------------- internal

    function _startRound(uint256 roomId, uint8 firstToAct) private {
        Room storage room = rooms[roomId];
        room.round += 1;
        room.phase = Phase.Rolling;
        room.turn = firstToAct;
        room.bidQuantity = 0;
        room.bidFace = 0;
        room.rolledCount = 0;
        emit RoundStarted(roomId, room.round, room.players[firstToAct]);
    }

    function _revealHand(uint256 roomId, address player) private {
        euint8[] storage hand = hands[roomId][player];
        for (uint256 i = 0; i < hand.length; i++) FHE.allowPublic(hand[i]);
    }

    function _nextAlive(uint256 roomId, uint8 from) private view returns (uint8) {
        Room storage room = rooms[roomId];
        uint8 n = uint8(room.players.length);
        for (uint8 step = 1; step <= n; step++) {
            uint8 idx = (from + step) % n;
            if (diceLeft[roomId][room.players[idx]] > 0) return idx;
        }
        return from;
    }

    function _aliveCount(uint256 roomId) private view returns (uint8 alive) {
        address[] storage players = rooms[roomId].players;
        for (uint256 i = 0; i < players.length; i++) if (diceLeft[roomId][players[i]] > 0) alive++;
    }

    function _totalDice(uint256 roomId) private view returns (uint256 total) {
        address[] storage players = rooms[roomId].players;
        for (uint256 i = 0; i < players.length; i++) total += diceLeft[roomId][players[i]];
    }
}
