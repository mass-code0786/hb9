// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract HBReferralRegistry is Ownable {
    mapping(address => address) public sponsorOf;
    mapping(bytes32 => address) public referralCodeOwner;
    mapping(address => bytes32) public referralCodeOf;

    event ReferralCodeRegistered(address indexed user, bytes32 indexed referralCode);
    event SponsorLinked(address indexed user, address indexed sponsor, bytes32 indexed referralCode);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerCode(bytes32 referralCode) external {
        require(referralCode != bytes32(0), "HB: empty code");
        require(referralCodeOwner[referralCode] == address(0), "HB: code used");
        require(referralCodeOf[msg.sender] == bytes32(0), "HB: user has code");
        referralCodeOwner[referralCode] = msg.sender;
        referralCodeOf[msg.sender] = referralCode;
        emit ReferralCodeRegistered(msg.sender, referralCode);
    }

    function linkSponsor(address user, address sponsor, bytes32 referralCode) external onlyOwner {
        require(user != address(0), "HB: user zero");
        require(sponsor != address(0), "HB: sponsor zero");
        require(user != sponsor, "HB: self sponsor");
        require(sponsorOf[user] == address(0), "HB: sponsor locked");
        sponsorOf[user] = sponsor;
        emit SponsorLinked(user, sponsor, referralCode);
    }
}
