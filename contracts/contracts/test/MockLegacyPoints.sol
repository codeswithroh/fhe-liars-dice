// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @dev Test stand-in for the previous FheLiarsDice deployment's `getPoints`.
contract MockLegacyPoints {
    mapping(address => uint256) public getPoints;

    function set(address player, uint256 points) external {
        getPoints[player] = points;
    }
}

/// @dev A legacy contract that always reverts, to prove carry-over can't brick the game.
contract RevertingLegacyPoints {
    function getPoints(address) external pure returns (uint256) {
        revert("boom");
    }
}

import {FheLiarsDice} from "../FheLiarsDice.sol";

/// @dev Exposes point awarding so leaderboard ordering/eviction can be tested at scale
///      without playing hundreds of encrypted games.
contract TestableFheLiarsDice is FheLiarsDice {
    constructor(address legacyPoints) FheLiarsDice(legacyPoints) {}

    function awardForTest(address player, uint256 amount) external {
        _register(player);
        _points[player] += amount;
        _updateLeaderboard(player);
    }
}
