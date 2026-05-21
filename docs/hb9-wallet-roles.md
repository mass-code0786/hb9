# HB9 BSC Mainnet Wallet Roles

HB9 production uses USDT BEP20 on BSC Mainnet only. BNB is required only for gas and is never a user deposit or withdrawal currency.

## Wallet Summary

| Role | Env | Holds | Private key location |
| --- | --- | --- | --- |
| Deployer wallet | `DEPLOYER_PRIVATE_KEY` | Small BNB for contract deployment gas | `contracts/.env` only |
| Fund/deposit wallet | `HB_TREASURY_DEPOSIT_ADDRESS` | User USDT BEP20 deposits | No server private key required |
| Withdrawal vault wallet | `HB_WITHDRAWAL_VAULT_ADDRESS` / `HB_WITHDRAWAL_TREASURY_ADDRESS` | USDT BEP20 payout liquidity and small BNB for gas | Server env only when direct server payouts are enabled |

## 1. Deployer Wallet

The deployer wallet is used only to deploy and verify HB9 contracts on BSC Mainnet.

- Store `DEPLOYER_PRIVATE_KEY` only in `contracts/.env`.
- Fund it with enough BNB to pay deployment and verification gas.
- Do not store this private key in `.env.production`, `server/.env.production`, frontend env, CI logs, or admin tools.
- After deployment, transfer contract ownership/admin roles to the intended owner, multisig, or vault admin.

## 2. Fund / Deposit Wallet

The fund/deposit wallet is where user deposits are collected.

Set `HB_TREASURY_DEPOSIT_ADDRESS` to the final production BSC wallet that receives user USDT BEP20 deposits.

Rules:

- Users deposit only USDT BEP20 on BSC Mainnet to this address.
- The BSC Mainnet USDT token is `0x55d398326f99059fF775485246999027B3197955`.
- The wallet does not need a private key on the API server for deposit verification.
- Keep enough operational controls to sweep, reconcile, and audit deposits.

## 3. Withdrawal Wallet / Vault

The withdrawal wallet/vault is the payout source for USDT withdrawals.

Set `HB_WITHDRAWAL_VAULT_ADDRESS` to the BSC wallet that signs and pays USDT BEP20 withdrawals when `HB_WITHDRAWAL_PROVIDER_ENABLED=true`. `HB_WITHDRAWAL_TREASURY_ADDRESS` is accepted as a backward-compatible alias.

Rules:

- Set `HB_WITHDRAWAL_VAULT_ADDRESS` to your own wallet address if you want your wallet to be the payout source.
- The treasury wallet must hold USDT BEP20 for payouts.
- If the server signs withdrawals directly from this wallet, the same wallet must also hold a small BNB balance for gas.
- `HB_WITHDRAWAL_SIGNER_PRIVATE_KEY` must belong to `HB_WITHDRAWAL_VAULT_ADDRESS`.
- `HB_WITHDRAWAL_SIGNER_PRIVATE_KEY` is required only when `HB_WITHDRAWAL_PROVIDER_ENABLED=true`.
- Never expose `HB_WITHDRAWAL_SIGNER_PRIVATE_KEY` to the frontend or any `NEXT_PUBLIC_*` env.

If a contract vault is introduced later, set your own wallet or multisig as the vault owner/admin. In that model, the server signer should not be given owner powers unless there is a deliberate operational reason.

## 4. USDT Only

HB9 BSC Mainnet money movement is restricted to:

- Deposit currency: USDT BEP20
- Withdrawal currency: USDT BEP20
- Chain: BSC Mainnet
- Chain ID: `56`
- Token address: `0x55d398326f99059fF775485246999027B3197955`

BNB is only for gas in the deployer wallet and withdrawal vault. It is not a user deposit currency and not a withdrawal currency.

## Security Rules

- Keep deployer, deposit, and withdrawal vault roles separate.
- Do not store the deployer private key on the API server.
- Do not put any private key in frontend env or `NEXT_PUBLIC_*` variables.
- Use a dedicated withdrawal vault with limited payout liquidity where possible.
- Rotate the withdrawal signer if it is exposed, copied to an unsafe location, or used by an unauthorized process.
- Keep production env files out of git.
- Reject deployment if production env still contains placeholders, example URLs, zero addresses, or missing wallet addresses.

## Deposit Verification

Deposits are accepted only when the backend verifies all of the following from BSC RPC:

- chain ID is `56`
- receipt exists, succeeded, and has the configured minimum confirmations
- transfer log is from official BSC USDT `0x55d398326f99059fF775485246999027B3197955`
- recipient is exactly `HB_TREASURY_DEPOSIT_ADDRESS`
- amount is at least `$4`
- transaction hash has not already been used

Verified deposits create an internal ledger credit, a USDT coin balance credit, an audit log, and ledger proof records linked to the on-chain transaction hash.

## Withdrawal Signing

Withdrawals are paid only as USDT BEP20 from the withdrawal vault. The API verifies that the configured signer private key derives the configured vault address before sending. Payouts use the gross amount, deduct a fixed 10% fee, and send the net amount. The payout transaction is waited for on-chain confirmation before the withdrawal is marked paid.

Manual admin `mark paid` also verifies the transaction hash against BSC receipt logs, token address, recipient wallet, net amount, and vault sender before recording it.

## Refilling Wallets

To refill the deposit wallet, send USDT BEP20 on BSC Mainnet to `HB_TREASURY_DEPOSIT_ADDRESS`. This wallet is the collection wallet; it does not need BNB unless an operator will move funds from it.

To refill the withdrawal vault, send USDT BEP20 to `HB_WITHDRAWAL_VAULT_ADDRESS`. Keep enough USDT for pending and expected withdrawals.

To refill BNB gas, send a small BNB amount on BSC Mainnet to the withdrawal vault. BNB is used only for transfer gas. Monitor the admin Treasury page for `BNB Gas Balance`.

## Safe Signer Rotation

1. Freeze withdrawals in Admin -> Production Controls.
2. Drain or stop using the old signer process.
3. Move USDT payout liquidity and BNB gas to the new vault wallet, or set the new signer key for the existing vault only if that key truly belongs to the same address.
4. Update `HB_WITHDRAWAL_VAULT_ADDRESS` and `HB_WITHDRAWAL_SIGNER_PRIVATE_KEY` in server production env.
5. Restart the API and confirm Admin shows `signer verified`, `withdrawal vault connected`, `BSC RPC connected`, and `USDT contract verified`.
6. Unfreeze withdrawals after a small live payout test.

Never rotate by pasting a private key into admin UI, chat, logs, or frontend env.

## Emergency Pause Steps

Use Admin -> Production Controls:

- `Freeze deposits` blocks new on-chain and hosted deposit creation.
- `Freeze withdrawals` blocks user withdrawal requests and admin payout state changes.
- `Pause packages` blocks package purchases and activations.
- `Disable conversion` blocks coin-to-USDT conversion.
- `Disable followers` blocks follower request submissions.
- `Emergency pause` blocks broad rollout-sensitive activity.

After enabling any freeze, review structured API logs for `hb.deposit.*`, `hb.withdrawal.*`, `hb.rpc.failed`, `hb.withdrawal.signer_failed`, duplicate attempts, and admin action logs before resuming.
