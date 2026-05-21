// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IHalalBusinessPackageManager {
    function buyPackage(uint256 packageId, address sponsorAddress, bytes32 referralCode) external;
}

contract ReentrantUSDT is ERC20 {
    IHalalBusinessPackageManager public target;
    address public sponsor;
    bytes32 public referralCode;
    bool public attackEnabled;
    bool public reentryBlocked;

    constructor() ERC20("Reentrant USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function configureAttack(IHalalBusinessPackageManager nextTarget, address nextSponsor, bytes32 nextReferralCode) external {
        target = nextTarget;
        sponsor = nextSponsor;
        referralCode = nextReferralCode;
    }

    function setAttackEnabled(bool enabled) external {
        attackEnabled = enabled;
        reentryBlocked = false;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (attackEnabled && address(target) != address(0)) {
            attackEnabled = false;
            try target.buyPackage(1, sponsor, referralCode) {
                reentryBlocked = false;
            } catch {
                reentryBlocked = true;
            }
        }
        return super.transferFrom(from, to, value);
    }
}
