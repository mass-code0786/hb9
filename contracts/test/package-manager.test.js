const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const packageTiers = [
  { id: 1, amount: "4" },
  { id: 2, amount: "20" },
  { id: 3, amount: "100" },
  { id: 4, amount: "500" },
  { id: 5, amount: "2500" },
  { id: 6, amount: "12500" }
];

function units(amount) {
  return ethers.parseUnits(String(amount), 18);
}

function splitAmounts(amount) {
  const total = units(amount);
  return {
    direct: (total * 20n) / 100n,
    level: (total * 30n) / 100n,
    treasuryHold: total - ((total * 20n) / 100n) - ((total * 30n) / 100n)
  };
}

describe("HalalBusinessPackageManager", function () {
  async function deployWithToken(tokenFactoryName = "MockUSDT") {
    const [owner, buyer, sponsor, sponsorTwo, direct, level, company, attacker] = await ethers.getSigners();
    const Token = await ethers.getContractFactory(tokenFactoryName);
    const usdtToken = await Token.deploy();
    const Registry = await ethers.getContractFactory("HBReferralRegistry");
    const registry = await Registry.deploy(owner.address);
    const Splitter = await ethers.getContractFactory("HBTreasurySplitter");
    const splitter = await Splitter.deploy(await usdtToken.getAddress(), owner.address);
    await splitter.setTreasuries(direct.address, level.address, company.address);
    const Manager = await ethers.getContractFactory("HalalBusinessPackageManager");
    const manager = await Manager.deploy(await usdtToken.getAddress(), await registry.getAddress(), await splitter.getAddress(), owner.address);
    await registry.transferOwnership(await manager.getAddress());
    await splitter.transferOwnership(await manager.getAddress());
    await manager.acceptTreasurySplitterOwnership();
    await usdtToken.mint(buyer.address, units("20000"));
    await usdtToken.mint(attacker.address, units("20000"));
    return { owner, buyer, sponsor, sponsorTwo, direct, level, company, attacker, usdt: usdtToken, registry, splitter, manager };
  }

  async function fixture() {
    return deployWithToken();
  }

  for (const tier of packageTiers) {
    it(`buys the $${tier.amount} package`, async function () {
      const { buyer, sponsor, direct, level, company, usdt, manager } = await fixture();
      const price = units(tier.amount);
      const expected = splitAmounts(tier.amount);

      await usdt.connect(buyer).approve(await manager.getAddress(), price);
      await expect(manager.connect(buyer).buyPackage(tier.id, sponsor.address, ethers.encodeBytes32String(`HB${tier.id}`)))
        .to.emit(manager, "PackagePurchased")
        .withArgs(
          anyValue,
          buyer.address,
          tier.id,
          price,
          sponsor.address,
          ethers.encodeBytes32String(`HB${tier.id}`)
        );

      expect(await manager.currentPackageId(buyer.address)).to.equal(tier.id);
      expect(await manager.currentPackagePrice(buyer.address)).to.equal(price);
      expect(await usdt.balanceOf(direct.address)).to.equal(expected.direct);
      expect(await usdt.balanceOf(level.address)).to.equal(expected.level);
      expect(await usdt.balanceOf(company.address)).to.equal(expected.treasuryHold);
    });
  }

  it("rejects invalid package ids", async function () {
    const { buyer, sponsor, usdt, manager } = await fixture();
    await usdt.connect(buyer).approve(await manager.getAddress(), units("100"));
    await expect(manager.connect(buyer).buyPackage(99, sponsor.address, ethers.ZeroHash)).to.be.revertedWith("HB: invalid package");
  });

  it("rejects missing USDT allowance", async function () {
    const { buyer, sponsor, manager } = await fixture();
    await expect(manager.connect(buyer).buyPackage(1, sponsor.address, ethers.ZeroHash)).to.be.reverted;
  });

  it("links sponsor by direct address", async function () {
    const { buyer, sponsor, usdt, registry, manager } = await fixture();
    await usdt.connect(buyer).approve(await manager.getAddress(), units("4"));

    await expect(manager.connect(buyer).buyPackage(1, sponsor.address, ethers.encodeBytes32String("DIRECT")))
      .to.emit(manager, "SponsorLinked")
      .withArgs(buyer.address, sponsor.address, ethers.encodeBytes32String("DIRECT"));

    expect(await registry.sponsorOf(buyer.address)).to.equal(sponsor.address);
  });

  it("links sponsor by referral code", async function () {
    const { buyer, sponsor, usdt, registry, manager } = await fixture();
    const referralCode = ethers.encodeBytes32String("SPONSOR");
    await registry.connect(sponsor).registerCode(referralCode);
    await usdt.connect(buyer).approve(await manager.getAddress(), units("4"));

    await expect(manager.connect(buyer).buyPackage(1, ethers.ZeroAddress, referralCode))
      .to.emit(manager, "SponsorLinked")
      .withArgs(buyer.address, sponsor.address, referralCode);

    expect(await registry.sponsorOf(buyer.address)).to.equal(sponsor.address);
  });

  it("prevents duplicate sponsor replacement", async function () {
    const { buyer, sponsor, sponsorTwo, usdt, registry, manager } = await fixture();
    await usdt.connect(buyer).approve(await manager.getAddress(), units("40"));
    await manager.connect(buyer).buyPackage(2, sponsor.address, ethers.encodeBytes32String("HB1"));
    await manager.connect(buyer).buyPackage(2, sponsorTwo.address, ethers.encodeBytes32String("HB2"));

    expect(await registry.sponsorOf(buyer.address)).to.equal(sponsor.address);
  });

  it("emits treasury split events with expected bucket amounts", async function () {
    const { buyer, sponsor, usdt, splitter, manager } = await fixture();
    const price = units("100");
    const expected = splitAmounts("100");
    await usdt.connect(buyer).approve(await manager.getAddress(), price);

    await expect(manager.connect(buyer).buyPackage(3, sponsor.address, ethers.encodeBytes32String("SPLIT")))
      .to.emit(splitter, "DistributionCreated")
      .withArgs(
        anyValue,
        buyer.address,
        price,
        expected.direct,
        expected.level,
        expected.treasuryHold
      )
      .and.to.emit(manager, "DistributionCreated")
      .withArgs(anyValue, buyer.address, 3, expected.direct, expected.level, expected.treasuryHold);
  });

  it("supports pause and unpause", async function () {
    const { owner, buyer, sponsor, usdt, manager } = await fixture();
    await manager.connect(owner).pause();
    await usdt.connect(buyer).approve(await manager.getAddress(), units("8"));
    await expect(manager.connect(buyer).buyPackage(1, sponsor.address, ethers.ZeroHash)).to.be.reverted;
    await manager.connect(owner).unpause();
    await expect(manager.connect(buyer).buyPackage(1, sponsor.address, ethers.ZeroHash)).to.emit(manager, "PackagePurchased");
  });

  it("supports owner emergency pause and unpause of treasury splitter", async function () {
    const { owner, buyer, sponsor, usdt, manager } = await fixture();
    await usdt.connect(buyer).approve(await manager.getAddress(), units("8"));
    await manager.connect(owner).pauseTreasurySplitter();
    await expect(manager.connect(buyer).buyPackage(1, sponsor.address, ethers.ZeroHash)).to.be.reverted;
    await manager.connect(owner).unpauseTreasurySplitter();
    await expect(manager.connect(buyer).buyPackage(1, sponsor.address, ethers.ZeroHash)).to.emit(manager, "PackagePurchased");
  });

  it("restricts pause and package configuration to owner", async function () {
    const { buyer, manager } = await fixture();
    await expect(manager.connect(buyer).pause()).to.be.reverted;
    await expect(manager.connect(buyer).setPackage(7, units("1"), true)).to.be.reverted;
  });

  it("allows only treasury owner to update treasury wallets", async function () {
    const [owner, nonOwner, direct, level, company] = await ethers.getSigners();
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const token = await MockUSDT.deploy();
    const Splitter = await ethers.getContractFactory("HBTreasurySplitter");
    const splitter = await Splitter.deploy(await token.getAddress(), owner.address);

    await expect(splitter.connect(nonOwner).setTreasuries(direct.address, level.address, company.address)).to.be.reverted;
    await expect(splitter.connect(owner).setTreasuries(direct.address, level.address, company.address))
      .to.emit(splitter, "TreasuryUpdated")
      .withArgs(ethers.encodeBytes32String("direct"), direct.address);
  });

  it("rejects zero treasury wallet updates", async function () {
    const [owner, direct, level] = await ethers.getSigners();
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const token = await MockUSDT.deploy();
    const Splitter = await ethers.getContractFactory("HBTreasurySplitter");
    const splitter = await Splitter.deploy(await token.getAddress(), owner.address);

    await expect(splitter.setTreasuries(direct.address, level.address, ethers.ZeroAddress)).to.be.revertedWith("HB: treasury zero");
  });

  it("blocks reentrant package buys from a malicious payment token", async function () {
    const { buyer, sponsor, usdt, manager } = await deployWithToken("ReentrantUSDT");
    await usdt.connect(buyer).approve(await manager.getAddress(), units("100"));
    await usdt.configureAttack(await manager.getAddress(), sponsor.address, ethers.encodeBytes32String("REENTER"));
    await usdt.setAttackEnabled(true);

    await expect(manager.connect(buyer).buyPackage(3, sponsor.address, ethers.encodeBytes32String("OUTER"))).to.emit(manager, "PackagePurchased");
    expect(await usdt.reentryBlocked()).to.equal(true);
    expect(await manager.currentPackageId(buyer.address)).to.equal(3);
  });
});
