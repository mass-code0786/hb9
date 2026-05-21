# HB9 QA Testing Guide

## BSC Testnet Mode

For a temporary local BSC testnet run, put these values in root `.env` and restart the dev server:

```bash
NEXT_PUBLIC_CHAIN_MODE=testnet
NEXT_PUBLIC_BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_BSC_CHAIN_ID=97
NEXT_PUBLIC_BSCSCAN_URL=https://testnet.bscscan.com
NEXT_PUBLIC_USDT_BEP20_ADDRESS=<your test BEP20 token>
```

Restart the dev server after changing chain mode.

## Get Test BNB

Use the BNB Chain testnet faucet from the official BNB Chain faucet page. Fund the wallet address shown in HB9, then refresh balances.

## Standalone Wallet Check

Run HB9 without any browser wallet extension installed or connected. The app must create, import, unlock, receive, estimate, and send using only the locally encrypted HB9 wallet.

## Verify Transactions

After sending test BNB, open the hash in `https://testnet.bscscan.com/tx/<hash>`. The hash shown in HB9 should match the explorer transaction.

## Tiny Test BNB Send Checklist

- Switch root `.env` to BSC testnet mode for the test run.
- Fund the HB9 address from the official BNB Chain testnet faucet.
- Send a tiny amount such as `0.0001` BNB to a second test wallet.
- Estimate gas first, then send.
- Copy the transaction hash and verify it on BscScan testnet.

## Test BEP20 Send Checklist

- Deploy or choose a BEP20 test token on BSC testnet.
- Set `NEXT_PUBLIC_USDT_BEP20_ADDRESS` to that token address.
- Fund the HB9 wallet with a small token balance.
- Send a tiny test token amount to a second test wallet.
- Verify token transfer events on the explorer.

## Troubleshooting

- If balances do not load, verify `NEXT_PUBLIC_BSC_RPC_URL` and chain ID `97`.
- If gas estimation fails, make sure the wallet has test BNB for gas.
- If BEP20 sends fail, confirm token decimals and contract address.
- If explorer links open mainnet, check `NEXT_PUBLIC_BSCSCAN_URL`.

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
