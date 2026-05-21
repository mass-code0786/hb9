const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const REQUIRED_TREASURIES = [
  ["TREASURY_DIRECT_ADDRESS", "direct"],
  ["TREASURY_LEVEL_ADDRESS", "level"],
  ["TREASURY_COMPANY_RESERVE_ADDRESS", "companyReserve"]
];

function requireAddress(name) {
  const value = process.env[name];
  if (!value || !hre.ethers.isAddress(value) || value === hre.ethers.ZeroAddress) {
    throw new Error(`${name} must be a valid non-zero address`);
  }
  return hre.ethers.getAddress(value);
}

async function wait(contract) {
  await contract.waitForDeployment();
  return contract;
}

async function deployContract(name, args) {
  const Factory = await hre.ethers.getContractFactory(name);
  const contract = await wait(await Factory.deploy(...args));
  const deployment = await contract.deploymentTransaction();
  return {
    contract,
    address: await contract.getAddress(),
    txHash: deployment?.hash || "",
    constructorArgs: args
  };
}

function deploymentPath(networkName) {
  const fileName = networkName === "bscTestnet" ? "bsc-testnet" : networkName === "bscMainnet" ? "bsc-mainnet" : networkName;
  return path.join(__dirname, "..", "deployments", `${fileName}.json`);
}

function writeDeployment(networkName, payload) {
  const file = deploymentPath(networkName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function requireMainnetDeployChecklist() {
  const checklist = [
    "contracts audited",
    "multisig owner ready",
    "real treasury addresses confirmed",
    "real USDT address confirmed",
    "owner private key not stored on server",
    "small test buy plan ready"
  ];
  console.warn("BSC Mainnet deployment safety checklist:");
  for (const item of checklist) console.warn(`- ${item}`);
  if (process.env.HB_MAINNET_DEPLOY_CHECKLIST_ACK !== "I_UNDERSTAND_MAINNET_DEPLOYMENT") {
    throw new Error("Set HB_MAINNET_DEPLOY_CHECKLIST_ACK=I_UNDERSTAND_MAINNET_DEPLOYMENT only after every mainnet deployment blocker is cleared.");
  }
  if (process.env.HB_MULTISIG_READY !== "true") {
    throw new Error("Set HB_MULTISIG_READY=true only after the multisig owner is created, funded, tested, and ready to receive ownership.");
  }
  if (!process.env.HB_MULTISIG_OWNER_ADDRESS || !hre.ethers.isAddress(process.env.HB_MULTISIG_OWNER_ADDRESS) || process.env.HB_MULTISIG_OWNER_ADDRESS === hre.ethers.ZeroAddress) {
    throw new Error("HB_MULTISIG_OWNER_ADDRESS must be a valid non-zero multisig wallet before BSC mainnet deployment.");
  }
}

async function main() {
  const networkName = hre.network.name;
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const [deployer, direct, level, companyReserve] = await hre.ethers.getSigners();
  const localNetwork = networkName === "hardhat" || networkName === "localhost";

  if (networkName === "bsc" || networkName === "bscMainnet") {
    requireMainnetDeployChecklist();
  }
  if (networkName === "bscMainnet" && !process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required for BSC mainnet deployment.");
  }
  if (networkName === "bscMainnet" && !process.env.BSC_MAINNET_RPC_URL) {
    throw new Error("BSC_MAINNET_RPC_URL is required for BSC mainnet deployment.");
  }

  const treasuryAddresses = localNetwork
    ? {
        direct: direct.address,
        level: level.address,
        companyReserve: companyReserve.address
      }
    : Object.fromEntries(REQUIRED_TREASURIES.map(([envName, key]) => [key, requireAddress(envName)]));

  const usdtTokenAddress = localNetwork
    ? ""
    : requireAddress("USDT_TOKEN_ADDRESS");

  console.log(`Deploying Halal Business contracts to ${networkName} (${chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  let mockUsdt = null;
  let paymentTokenAddress = usdtTokenAddress;
  if (localNetwork) {
    mockUsdt = await deployContract("MockUSDT", []);
    paymentTokenAddress = mockUsdt.address;
    console.log(`MockUSDT: ${mockUsdt.address}`);
  }

  const registry = await deployContract("HBReferralRegistry", [deployer.address]);
  console.log(`HBReferralRegistry: ${registry.address}`);

  const splitter = await deployContract("HBTreasurySplitter", [paymentTokenAddress, deployer.address]);
  console.log(`HBTreasurySplitter: ${splitter.address}`);

  const incomeDistributor = await deployContract("HBIncomeDistributor", [deployer.address]);
  console.log(`HBIncomeDistributor: ${incomeDistributor.address}`);

  const manager = await deployContract("HalalBusinessPackageManager", [
    paymentTokenAddress,
    registry.address,
    splitter.address,
    deployer.address
  ]);
  console.log(`HalalBusinessPackageManager: ${manager.address}`);

  const splitterContract = splitter.contract;
  await (await splitterContract.setTreasuries(
    treasuryAddresses.direct,
    treasuryAddresses.level,
    treasuryAddresses.companyReserve
  )).wait();
  console.log("Treasury wallets configured");

  await (await registry.contract.transferOwnership(manager.address)).wait();
  await (await splitter.contract.transferOwnership(manager.address)).wait();
  await (await manager.contract.acceptTreasurySplitterOwnership()).wait();
  console.log("Registry and treasury splitter ownership transferred to package manager");

  const multisigOwner = process.env.HB_MULTISIG_OWNER_ADDRESS ? hre.ethers.getAddress(process.env.HB_MULTISIG_OWNER_ADDRESS) : "";
  if ((networkName === "bsc" || networkName === "bscMainnet") && multisigOwner) {
    await (await manager.contract.transferOwnership(multisigOwner)).wait();
    await (await incomeDistributor.contract.transferOwnership(multisigOwner)).wait();
    console.log(`Package manager and income distributor ownership transfer queued for multisig acceptance: ${multisigOwner}`);
  }

  const payload = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      MockUSDT: mockUsdt ? { address: mockUsdt.address, txHash: mockUsdt.txHash, constructorArgs: [] } : null,
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
    paymentToken: paymentTokenAddress,
    treasuries: treasuryAddresses,
    ownership: {
      registryOwner: manager.address,
      treasurySplitterOwner: manager.address,
      packageManagerOwner: deployer.address,
      incomeDistributorOwner: deployer.address,
      pendingPackageManagerOwner: multisigOwner || null,
      pendingIncomeDistributorOwner: multisigOwner || null,
      multisigOwner: multisigOwner || null
    }
  };

  const outputFile = writeDeployment(networkName, payload);
  console.log(`Deployment output saved: ${outputFile}`);
  console.log(JSON.stringify(payload.contracts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
