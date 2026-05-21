const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const BSC_MAINNET_CHAIN_ID = 56;
const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
const CHECKLIST_ACK = "I_UNDERSTAND_MAINNET_DEPLOYMENT";
const DEPLOYMENT_FILE = path.join(__dirname, "..", "deployments", "bsc-mainnet.json");

const TREASURY_ENVS = [
  ["TREASURY_DIRECT_ADDRESS", "direct"],
  ["TREASURY_LEVEL_ADDRESS", "level"],
  ["TREASURY_COMPANY_RESERVE_ADDRESS", "companyReserve"]
];

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required in contracts/.env`);
  return value;
}

function requireAddress(name) {
  const value = requireEnv(name);
  if (!hre.ethers.isAddress(value) || hre.ethers.getAddress(value) === hre.ethers.ZeroAddress) {
    throw new Error(`${name} must be a valid non-zero BSC address`);
  }
  return hre.ethers.getAddress(value);
}

function validateStaticEnv() {
  requireEnv("BSC_MAINNET_RPC_URL");
  requireEnv("DEPLOYER_PRIVATE_KEY");
  requireEnv("BSCSCAN_API_KEY");

  if (process.env.HB_MAINNET_DEPLOY_CHECKLIST_ACK !== CHECKLIST_ACK) {
    throw new Error(`HB_MAINNET_DEPLOY_CHECKLIST_ACK must equal ${CHECKLIST_ACK}`);
  }
  if (process.env.HB_MULTISIG_READY !== "true") {
    throw new Error("HB_MULTISIG_READY must be true before BSC Mainnet deployment");
  }

  const usdt = requireAddress("USDT_TOKEN_ADDRESS");
  if (usdt !== hre.ethers.getAddress(BSC_USDT)) {
    throw new Error("USDT_TOKEN_ADDRESS must be official BSC Mainnet USDT");
  }

  const multisigOwner = requireAddress("HB_MULTISIG_OWNER_ADDRESS");
  const treasuries = Object.fromEntries(TREASURY_ENVS.map(([envName, key]) => [key, requireAddress(envName)]));

  return { usdt, multisigOwner, treasuries };
}

async function validateNetworkAndSigner() {
  if (hre.network.name !== "bscMainnet") {
    throw new Error("Run with --network bscMainnet");
  }

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== BSC_MAINNET_CHAIN_ID) {
    throw new Error(`Connected chainId must be 56. Got ${chainId}`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  if (balance <= 0n) {
    throw new Error("Deployer has no BNB gas balance");
  }

  return {
    chainId,
    deployerAddress: deployer.address,
    deployerBnbBalance: hre.ethers.formatEther(balance)
  };
}

async function deployContract(name, args) {
  const Factory = await hre.ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  const tx = contract.deploymentTransaction();
  return {
    contract,
    address: await contract.getAddress(),
    txHash: tx?.hash || "",
    constructorArgs: args
  };
}

function writeDeployment(payload) {
  fs.mkdirSync(path.dirname(DEPLOYMENT_FILE), { recursive: true });
  fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(payload, null, 2));
}

async function main() {
  const checkOnly = process.argv.includes("--check-only") || process.env.HB_DEPLOY_CHECK_ONLY === "true";
  const env = validateStaticEnv();
  const network = await validateNetworkAndSigner();

  console.log("HB9 BSC Mainnet deployment validation passed");
  console.log(`Network chainId: ${network.chainId}`);
  console.log(`Deployer: ${network.deployerAddress}`);
  console.log(`Deployer BNB gas balance: ${network.deployerBnbBalance}`);
  console.log(`USDT: ${env.usdt}`);
  console.log(`Multisig owner: ${env.multisigOwner}`);

  if (checkOnly) {
    console.log("Check-only mode complete. No contracts deployed.");
    return;
  }

  const registry = await deployContract("HBReferralRegistry", [network.deployerAddress]);
  console.log(`HBReferralRegistry deployed: ${registry.address}`);

  const splitter = await deployContract("HBTreasurySplitter", [env.usdt, network.deployerAddress]);
  console.log(`HBTreasurySplitter deployed: ${splitter.address}`);

  const incomeDistributor = await deployContract("HBIncomeDistributor", [network.deployerAddress]);
  console.log(`HBIncomeDistributor deployed: ${incomeDistributor.address}`);

  const manager = await deployContract("HalalBusinessPackageManager", [
    env.usdt,
    registry.address,
    splitter.address,
    network.deployerAddress
  ]);
  console.log(`HalalBusinessPackageManager deployed: ${manager.address}`);

  await (await splitter.contract.setTreasuries(
    env.treasuries.direct,
    env.treasuries.level,
    env.treasuries.companyReserve
  )).wait();
  console.log("Treasury wallets configured");

  await (await registry.contract.transferOwnership(manager.address)).wait();
  await (await splitter.contract.transferOwnership(manager.address)).wait();
  await (await manager.contract.acceptTreasurySplitterOwnership()).wait();
  await (await manager.contract.transferOwnership(env.multisigOwner)).wait();
  await (await incomeDistributor.contract.transferOwnership(env.multisigOwner)).wait();
  console.log("Ownership transferred/queued to production control structure");

  const payload = {
    network: "bscMainnet",
    chainId: network.chainId,
    deployer: network.deployerAddress,
    usdtAddress: env.usdt,
    treasuryAddresses: env.treasuries,
    timestamp: new Date().toISOString(),
    contracts: {
      HBReferralRegistry: {
        address: registry.address,
        txHash: registry.txHash,
        constructorArgs: registry.constructorArgs
      },
      HBTreasurySplitter: {
        address: splitter.address,
        txHash: splitter.txHash,
        constructorArgs: splitter.constructorArgs
      },
      HBIncomeDistributor: {
        address: incomeDistributor.address,
        txHash: incomeDistributor.txHash,
        constructorArgs: incomeDistributor.constructorArgs
      },
      HalalBusinessPackageManager: {
        address: manager.address,
        txHash: manager.txHash,
        constructorArgs: manager.constructorArgs
      }
    },
    ownership: {
      referralRegistryOwner: manager.address,
      treasurySplitterOwner: manager.address,
      packageManagerPendingOwner: env.multisigOwner,
      incomeDistributorPendingOwner: env.multisigOwner,
      multisigOwner: env.multisigOwner
    }
  };

  writeDeployment(payload);
  console.log(`Deployment output saved: ${DEPLOYMENT_FILE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
