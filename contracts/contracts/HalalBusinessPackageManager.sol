// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HBReferralRegistry} from "./HBReferralRegistry.sol";
import {HBTreasurySplitter} from "./HBTreasurySplitter.sol";

contract HalalBusinessPackageManager is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PackageConfig {
        uint256 price;
        bool active;
    }

    IERC20 public immutable paymentToken;
    HBReferralRegistry public referralRegistry;
    HBTreasurySplitter public treasurySplitter;

    mapping(uint256 => PackageConfig) public packages;
    mapping(address => uint256) public currentPackageId;
    mapping(address => uint256) public currentPackagePrice;

    event PackageConfigured(uint256 indexed packageId, uint256 price, bool active);
    event PackagePurchased(
        bytes32 indexed purchaseId,
        address indexed buyer,
        uint256 indexed packageId,
        uint256 price,
        address sponsor,
        bytes32 referralCode
    );
    event SponsorLinked(address indexed buyer, address indexed sponsor, bytes32 indexed referralCode);
    event DistributionCreated(
        bytes32 indexed purchaseId,
        address indexed buyer,
        uint256 packageId,
        uint256 directAmount,
        uint256 levelAmount,
        uint256 treasuryHoldAmount
    );

    constructor(
        IERC20 token,
        HBReferralRegistry registry,
        HBTreasurySplitter splitter,
        address initialOwner
    ) Ownable(initialOwner) {
        require(address(token) != address(0), "HB: token zero");
        require(address(registry) != address(0), "HB: registry zero");
        require(address(splitter) != address(0), "HB: splitter zero");
        paymentToken = token;
        referralRegistry = registry;
        treasurySplitter = splitter;

        _setPackage(1, 4e18, true);
        _setPackage(2, 20e18, true);
        _setPackage(3, 100e18, true);
        _setPackage(4, 500e18, true);
        _setPackage(5, 2500e18, true);
        _setPackage(6, 12500e18, true);
    }

    function buyPackage(uint256 packageId, address sponsorAddress, bytes32 referralCode) external nonReentrant whenNotPaused {
        PackageConfig memory packageConfig = packages[packageId];
        require(packageConfig.active, "HB: invalid package");
        require(packageConfig.price > 0, "HB: price missing");

        address sponsor = sponsorAddress;
        if (sponsor == address(0) && referralCode != bytes32(0)) {
            sponsor = referralRegistry.referralCodeOwner(referralCode);
        }
        if (sponsor != address(0) && referralRegistry.sponsorOf(msg.sender) == address(0)) {
            referralRegistry.linkSponsor(msg.sender, sponsor, referralCode);
            emit SponsorLinked(msg.sender, sponsor, referralCode);
        }

        bytes32 purchaseId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, packageId, block.number, currentPackagePrice[msg.sender]));
        paymentToken.safeTransferFrom(msg.sender, address(treasurySplitter), packageConfig.price);
        treasurySplitter.split(purchaseId, msg.sender, packageConfig.price);

        currentPackageId[msg.sender] = packageId;
        currentPackagePrice[msg.sender] = packageConfig.price;

        emit PackagePurchased(purchaseId, msg.sender, packageId, packageConfig.price, sponsor, referralCode);
        emit DistributionCreated(
            purchaseId,
            msg.sender,
            packageId,
            (packageConfig.price * 20) / 100,
            (packageConfig.price * 30) / 100,
            packageConfig.price - ((packageConfig.price * 20) / 100) - ((packageConfig.price * 30) / 100)
        );
    }

    function setPackage(uint256 packageId, uint256 price, bool active) external onlyOwner {
        _setPackage(packageId, price, active);
    }

    function setDependencies(HBReferralRegistry registry, HBTreasurySplitter splitter) external onlyOwner {
        require(address(registry) != address(0), "HB: registry zero");
        require(address(splitter) != address(0), "HB: splitter zero");
        referralRegistry = registry;
        treasurySplitter = splitter;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function pauseTreasurySplitter() external onlyOwner {
        treasurySplitter.pause();
    }

    function unpauseTreasurySplitter() external onlyOwner {
        treasurySplitter.unpause();
    }

    function acceptTreasurySplitterOwnership() external onlyOwner {
        treasurySplitter.acceptOwnership();
    }

    function _setPackage(uint256 packageId, uint256 price, bool active) internal {
        require(packageId > 0, "HB: package zero");
        require(price > 0, "HB: price zero");
        packages[packageId] = PackageConfig(price, active);
        emit PackageConfigured(packageId, price, active);
    }
}
