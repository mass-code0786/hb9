// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract HBIncomeDistributor is Ownable2Step {
    event IncomeIndexed(bytes32 indexed purchaseId, address indexed buyer, address indexed receiver, uint256 amount, uint8 level);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function emitIndexedIncome(bytes32 purchaseId, address buyer, address receiver, uint256 amount, uint8 level) external onlyOwner {
        emit IncomeIndexed(purchaseId, buyer, receiver, amount, level);
    }
}
