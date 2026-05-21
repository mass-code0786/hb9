# HB9 BSC Mainnet Contract Deployment

This guide creates a safe manual deployment flow for HB9 contracts on BSC Mainnet. The scripts never print private keys and do not deploy unless you explicitly run the deploy command.

## Contracts Deployed

- `HBReferralRegistry`
- `HBTreasurySplitter`
- `HBIncomeDistributor`
- `HalalBusinessPackageManager`

## Fill `contracts/.env`

Create `contracts/.env` with:

```env
BSC_MAINNET_RPC_URL=
BSCSCAN_API_KEY=
DEPLOYER_PRIVATE_KEY=
USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955

HB_MULTISIG_OWNER_ADDRESS=

TREASURY_DIRECT_ADDRESS=
TREASURY_LEVEL_ADDRESS=
TREASURY_COMPANY_RESERVE_ADDRESS=

HB_MAINNET_DEPLOY_CHECKLIST_ACK=I_UNDERSTAND_MAINNET_DEPLOYMENT
HB_MULTISIG_READY=true
```

Rules:

- `DEPLOYER_PRIVATE_KEY` must stay only in `contracts/.env`.
- `HB_MULTISIG_OWNER_ADDRESS` must be the production owner wallet or multisig.
- All treasury addresses must be final BSC Mainnet addresses.
- `USDT_TOKEN_ADDRESS` must remain official BSC USDT.
- The deployer needs enough BNB for contract deployment gas.
- The active HB9 package split is `20%` direct, `30%` level, and `50%` treasury hold/company reserve.

## Preflight Check

Run this first:

```bash
npm run deploy:check:bsc-mainnet
```

The check validates:

- connected chain ID is `56`
- deployer has BNB gas
- deployer key exists without printing it
- all treasury addresses are valid
- USDT address is official BSC USDT
- multisig address is valid
- checklist ack is exact
- multisig ready flag is `true`

## Deploy

Only after the preflight passes:

```bash
npm run deploy:bsc-mainnet
```

The deployment output is saved to:

```text
contracts/deployments/bsc-mainnet.json
```

It includes contract addresses, deployment tx hashes, deployer address, chain ID, USDT address, treasury addresses, and timestamp.

## Verify on BscScan

After deployment:

```bash
npm run verify:bsc-mainnet
```

The verification script reads constructor arguments from `contracts/deployments/bsc-mainnet.json`.

## Copy Addresses Into App Env

After deployment and verification, copy addresses from `contracts/deployments/bsc-mainnet.json`.

Set in `.env.production`:

```env
NEXT_PUBLIC_HB_PACKAGE_MANAGER_ADDRESS=
NEXT_PUBLIC_HB_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
NEXT_PUBLIC_CHAIN_ID=56
```

Set in `server/.env.production`:

```env
HB_PACKAGE_MANAGER_ADDRESS=
HB_REFERRAL_REGISTRY_ADDRESS=
HB_TREASURY_SPLITTER_ADDRESS=
HB_INCOME_DISTRIBUTOR_ADDRESS=
USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
HB_CHAIN_ID=56
```

Required address mapping:

- `NEXT_PUBLIC_HB_PACKAGE_MANAGER_ADDRESS` and `HB_PACKAGE_MANAGER_ADDRESS`: `contracts.HalalBusinessPackageManager.address`
- `HB_REFERRAL_REGISTRY_ADDRESS`: `contracts.HBReferralRegistry.address`
- `HB_TREASURY_SPLITTER_ADDRESS`: `contracts.HBTreasurySplitter.address`
- `HB_INCOME_DISTRIBUTOR_ADDRESS`: `contracts.HBIncomeDistributor.address`

## Post-Deploy Checks

1. Confirm all four contracts are verified on BscScan.
2. Confirm multisig accepts ownership for `HalalBusinessPackageManager` and `HBIncomeDistributor`.
3. Confirm package manager owns `HBReferralRegistry`.
4. Confirm package manager owns `HBTreasurySplitter`.
5. Confirm treasury wallets in BscScan match `contracts/.env`.
6. Restart frontend/API with updated production env.
7. Run a small controlled package buy from a test production wallet.

## Safety Notes

- Do not commit `contracts/.env`.
- Do not paste private keys into admin UI, frontend env, chat, logs, or deployment output.
- Do not run deploy with a personal wallet unless it is intended to be the deployer.
- Do not deploy until multisig owner and all treasury wallets are final.
