// Generated from contracts/artifacts/contracts/FheLiarsDice.sol/FheLiarsDice.json -- regenerate after
// changing the contract.
export const fheLiarsDiceAbi = [
  {
    "inputs": [],
    "name": "AlreadyJoined",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "face",
        "type": "uint8"
      }
    ],
    "name": "InvalidFace",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "maxPlayers",
        "type": "uint8"
      }
    ],
    "name": "InvalidPlayerCount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidQuantity",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MustEscalateBid",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoActiveBid",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoPendingChallenge",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoPendingReveal",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAPlayer",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotEnoughPlayers",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotHost",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotInProgress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotYourTurn",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PlayerEliminatedError",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RevealNotReady",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "int32",
        "name": "value",
        "type": "int32"
      }
    ],
    "name": "SecurityZoneOutOfBounds",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TableFull",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TableNotInLobby",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "VerdictNotReady",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "quantity",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "face",
        "type": "uint8"
      }
    ],
    "name": "BidPlaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "challenger",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "bidder",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "quantity",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "face",
        "type": "uint8"
      }
    ],
    "name": "ChallengeCalled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      }
    ],
    "name": "GameStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      },
      {
        "indexed": false,
        "internalType": "uint8[][]",
        "name": "dice",
        "type": "uint8[][]"
      }
    ],
    "name": "HandsRevealed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "legacyPoints",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newTotal",
        "type": "uint256"
      }
    ],
    "name": "LegacyPointsSynced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "PlayerEliminated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "PlayerJoined",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newTotal",
        "type": "uint256"
      }
    ],
    "name": "PointsAwarded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address[]",
        "name": "activePlayers",
        "type": "address[]"
      }
    ],
    "name": "RoundStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "host",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "maxPlayers",
        "type": "uint8"
      }
    ],
    "name": "TableCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "winner",
        "type": "address"
      }
    ],
    "name": "TableEnded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "bidWasGood",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "loser",
        "type": "address"
      }
    ],
    "name": "VerdictRevealed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DICE_PER_PLAYER",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LEADERBOARD_SIZE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_PLAYERS",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_PLAYERS",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "VERSION",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "WILD_FACE",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "challenge",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "maxPlayers",
        "type": "uint8"
      }
    ],
    "name": "createTable",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "diceCount",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "eliminated",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "verdictResult",
        "type": "bool"
      },
      {
        "internalType": "bytes",
        "name": "signature",
        "type": "bytes"
      }
    ],
    "name": "finalizeChallenge",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "internalType": "uint8[]",
        "name": "results",
        "type": "uint8[]"
      },
      {
        "internalType": "bytes[]",
        "name": "signatures",
        "type": "bytes[]"
      }
    ],
    "name": "finalizeReveal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "getActivePlayers",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllPlayerPoints",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "pointsList",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "getBidHistory",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint8",
            "name": "quantity",
            "type": "uint8"
          },
          {
            "internalType": "uint8",
            "name": "face",
            "type": "uint8"
          },
          {
            "internalType": "address",
            "name": "bidder",
            "type": "address"
          }
        ],
        "internalType": "struct FheLiarsDice.Bid[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLeaderboard",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "pointsList",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getLeaderboardRank",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "getMyDiceHandles",
    "outputs": [
      {
        "internalType": "euint8[]",
        "name": "handles",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "getPendingRevealHandles",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      },
      {
        "internalType": "euint8[][]",
        "name": "handles",
        "type": "bytes32[][]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "getPendingVerdictHandle",
    "outputs": [
      {
        "internalType": "ebool",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPlayerCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "offset",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "limit",
        "type": "uint256"
      }
    ],
    "name": "getPlayerPoints",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "pointsList",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getPoints",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "getTable",
    "outputs": [
      {
        "internalType": "address",
        "name": "host",
        "type": "address"
      },
      {
        "internalType": "uint8",
        "name": "maxPlayers",
        "type": "uint8"
      },
      {
        "internalType": "enum FheLiarsDice.Phase",
        "name": "phase",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      },
      {
        "internalType": "bool[]",
        "name": "eliminatedFlags",
        "type": "bool[]"
      },
      {
        "internalType": "uint8",
        "name": "turnIdx",
        "type": "uint8"
      },
      {
        "components": [
          {
            "internalType": "uint8",
            "name": "quantity",
            "type": "uint8"
          },
          {
            "internalType": "uint8",
            "name": "face",
            "type": "uint8"
          },
          {
            "internalType": "address",
            "name": "bidder",
            "type": "address"
          }
        ],
        "internalType": "struct FheLiarsDice.Bid",
        "name": "currentBid",
        "type": "tuple"
      },
      {
        "internalType": "bool",
        "name": "hasBid",
        "type": "bool"
      },
      {
        "internalType": "address",
        "name": "winner",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "isPlayerAt",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "joinTable",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "legacy",
    "outputs": [
      {
        "internalType": "contract ILegacyPoints",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "legacySynced",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextTableId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "quantity",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "face",
        "type": "uint8"
      }
    ],
    "name": "placeBid",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      },
      {
        "internalType": "uint8[]",
        "name": "results",
        "type": "uint8[]"
      },
      {
        "internalType": "bytes[]",
        "name": "signatures",
        "type": "bytes[]"
      }
    ],
    "name": "revealAfterElimination",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tableId",
        "type": "uint256"
      }
    ],
    "name": "startGame",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "players",
        "type": "address[]"
      }
    ],
    "name": "syncLegacyPoints",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

/** FheLiarsDice v1.0.1 (CoFHE 1.0) on Arbitrum Sepolia. Override per environment with
 *  NEXT_PUBLIC_FHE_LIARS_DICE_ADDRESS; the default keeps a misconfigured build pointed at the
 *  live game instead of the zero address. */
export const FHE_LIARS_DICE_ADDRESS = (process.env.NEXT_PUBLIC_FHE_LIARS_DICE_ADDRESS ||
  "0x645761Fd1b8fB752f7Bc7C0AB16b5Da3305b8F76") as `0x${string}`;

export const GamePhase = {
  Lobby: 0,
  InProgress: 1,
  ChallengePending: 2,
  RevealPending: 3,
  Ended: 4,
} as const;

export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase];

export const FACE_LABELS = ["", "one (wild)", "two", "three", "four", "five", "six"];
