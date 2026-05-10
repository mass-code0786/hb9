# BitzenX QA Testing Guide

## BSC Testnet Mode

Use these environment values in `.env.local`:

```bash
NEXT_PUBLIC_CHAIN_MODE=testnet
NEXT_PUBLIC_BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_BSC_CHAIN_ID=97
NEXT_PUBLIC_BSCSCAN_URL=https://testnet.bscscan.com
NEXT_PUBLIC_USDT_BEP20_ADDRESS=<your test BEP20 token>
```

Restart the dev server after changing chain mode.

## Get Test BNB

Use the BNB Chain testnet faucet from the official BNB Chain faucet page. Fund the wallet address shown in BitzenX, then refresh balances.

## Compare With MetaMask Or TokenPocket

Import the same recovery phrase into MetaMask or TokenPocket only in a test wallet. Select BSC Testnet, compare the derived address, and verify BNB balance parity.

## Verify Transactions

After sending test BNB, open the hash in `https://testnet.bscscan.com/tx/<hash>`. The hash shown in BitzenX should match the explorer transaction.

## Manual Mobile QA

Test at 390x844 and 360x740:

- Create wallet, seed warning checkbox, confirm backup, set password
- Refresh browser and verify the wallet returns to unlock screen
- Lock/unlock manually
- Receive QR page and copy warning
- Send BNB/USDT validation and gas estimate states
- Recharge quote, preview, create, history empty/success states
- QR Pay camera permission, manual input fallback, success/failure states
- Bottom navigation and no horizontal overflow
