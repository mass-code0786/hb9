// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract HBTreasurySplitter is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;

    address public directIncomeTreasury;
    address public levelIncomeTreasury;
    address public companyReserveTreasury;

    event TreasuryUpdated(bytes32 indexed key, address indexed wallet);
    event DistributionCreated(
        bytes32 indexed purchaseId,
        address indexed buyer,
        uint256 amount,
        uint256 directAmount,
        uint256 levelAmount,
        uint256 treasuryHoldAmount
    );

    constructor(IERC20 token, address initialOwner) Ownable(initialOwner) {
        require(address(token) != address(0), "HB: token zero");
        paymentToken = token;
    }

    function setTreasuries(
        address directWallet,
        address levelWallet,
        address companyWallet
    ) external onlyOwner {
        _requireWallet(directWallet);
        _requireWallet(levelWallet);
        _requireWallet(companyWallet);
        directIncomeTreasury = directWallet;
        levelIncomeTreasury = levelWallet;
        companyReserveTreasury = companyWallet;
        emit TreasuryUpdated("direct", directWallet);
        emit TreasuryUpdated("level", levelWallet);
        emit TreasuryUpdated("treasury_hold", companyWallet);
    }

    function split(bytes32 purchaseId, address buyer, uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        _requireConfigured();
        uint256 directAmount = (amount * 20) / 100;
        uint256 levelAmount = (amount * 30) / 100;
        uint256 treasuryHoldAmount = amount - directAmount - levelAmount;

        paymentToken.safeTransfer(directIncomeTreasury, directAmount);
        paymentToken.safeTransfer(levelIncomeTreasury, levelAmount);
        paymentToken.safeTransfer(companyReserveTreasury, treasuryHoldAmount);

        emit DistributionCreated(purchaseId, buyer, amount, directAmount, levelAmount, treasuryHoldAmount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _requireConfigured() internal view {
        _requireWallet(directIncomeTreasury);
        _requireWallet(levelIncomeTreasury);
        _requireWallet(companyReserveTreasury);
    }

    function _requireWallet(address wallet) internal pure {
        require(wallet != address(0), "HB: treasury zero");
    }
}
