const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const DEPLOYMENT_FILE = path.join(__dirname, "..", "deployments", "bsc-mainnet.json");

async function verify(name, item) {
  if (!item?.address) return;
  console.log(`Verifying ${name}: ${item.address}`);
  try {
    await hre.run("verify:verify", {
      address: item.address,
      constructorArguments: item.constructorArgs || []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log(`${name} is already verified`);
      return;
    }
    throw error;
  }
}

async function main() {
  if (hre.network.name !== "bscMainnet") {
    throw new Error("Run this script with --network bscMainnet");
  }
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 56) {
    throw new Error(`Connected chainId must be 56. Got ${network.chainId}`);
  }
  if (!process.env.BSCSCAN_API_KEY) {
    throw new Error("BSCSCAN_API_KEY is required for verification.");
  }
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(`Deployment file not found: ${DEPLOYMENT_FILE}`);
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
  const contracts = deployment.contracts || {};

  await verify("HBReferralRegistry", contracts.HBReferralRegistry);
  await verify("HBTreasurySplitter", contracts.HBTreasurySplitter);
  await verify("HBIncomeDistributor", contracts.HBIncomeDistributor);
  await verify("HalalBusinessPackageManager", contracts.HalalBusinessPackageManager);

  if (contracts.MockUSDT) {
    console.log("Skipping MockUSDT verification for BSC mainnet; MockUSDT is local/test only.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
