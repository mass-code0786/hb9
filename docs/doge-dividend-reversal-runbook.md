# One-time $500 Business Package DOGE dividend reversal

This runbook debits exactly 1324 DOGE from each of the three users in one exact
incorrect `$500 Business Package` bulk distribution. The original distribution
credited 1327.31132499 DOGE per user. Original credit, dividend, and other
ledger records remain untouched.

The batch identifier used by the application is
`hb:funds:bulk:<SOURCE_ACTION_ID>`. Per-user dividend rows point to the
individual `hb_admin_balance_actions.id` values within that exact batch.

## 1. Find and confirm the exact incorrect distribution

Use the local display timestamp only to find candidates. This query does not
authorize a reversal:

```sql
select split_part(a.idempotency_key, ':', 4) as source_action_id,
       min(a.created_at at time zone 'Asia/Kolkata') as created_at_local,
       min(source_coin.metadata->>'packageName') as package_name,
       min(source_coin.metadata->>'packageAmount') as package_amount,
       a.coin_symbol,
       a.amount::text as distributed_doge_per_user,
       a.note,
       count(distinct a.user_id) as receiver_count
  from hb_admin_balance_actions a
  join hb_coin_balance_ledger source_coin on source_coin.id = a.ledger_entry_id
 where a.type = 'bulk_distribution'
   and a.coin_symbol = 'DOGE'
   and a.amount = 1327.31132499::numeric
   and lower(btrim(a.note)) = 'dividend'
   and source_coin.metadata->>'targetMode' = 'package'
   and source_coin.metadata->>'packageAmount' = '500'
   and a.created_at >= ('2026-07-27 14:23:59'::timestamp - interval '5 minutes')
                         at time zone 'Asia/Kolkata'
   and a.created_at <= ('2026-07-27 14:23:59'::timestamp + interval '5 minutes')
                         at time zone 'Asia/Kolkata'
 group by split_part(a.idempotency_key, ':', 4),
          a.coin_symbol, a.amount, a.note
 order by min(a.created_at);
```

Copy the single reviewed `source_action_id`, then confirm it by exact identifier
with no date filter:

```sql
with exact_batch as (
  select a.id,
         a.user_id,
         a.ledger_entry_id,
         a.coin_symbol,
         a.amount,
         a.note,
         a.created_at,
         source_coin.metadata
    from hb_admin_balance_actions a
    join hb_coin_balance_ledger source_coin on source_coin.id = a.ledger_entry_id
   where a.idempotency_key =
         'hb:funds:bulk:<INCORRECT_SOURCE_ACTION_ID>:' || a.user_id::text
)
select 'hb:funds:bulk:<INCORRECT_SOURCE_ACTION_ID>' as distribution_identifier,
       min(metadata->>'packageName') as package_name,
       min(metadata->>'packageAmount') as package_amount,
       min(coin_symbol) as coin_symbol,
       min(amount)::text as distributed_doge_per_user,
       min(note) as note,
       count(distinct user_id) as receiver_count,
       min(created_at at time zone 'Asia/Kolkata') as created_at_local
  from exact_batch;
```

Proceed only when the result is Business Package, `500`, DOGE,
`1327.31132499`, Dividend, and exactly `3` receivers.

Derive and review the exact three users and their latest completed packages:

```sql
select a.user_id,
       a.id as admin_action_id,
       d.id as dividend_ledger_id,
       d.coin_amount::text as original_doge_credited,
       latest_package.id as latest_completed_package_purchase_id,
       latest_package.amount_usd::text as latest_completed_package_usd
  from hb_admin_balance_actions a
  join hb_dividend_income_ledger d
    on d.source_action_id = a.id
   and d.coin_symbol = 'DOGE'
   and d.status = 'credited'
  join lateral (
    select p.id, p.amount_usd
      from hb_package_purchases p
     where p.user_id = a.user_id and p.status = 'completed'
     order by p.created_at desc, p.id desc
     limit 1
  ) latest_package on true
 where a.idempotency_key =
       'hb:funds:bulk:<INCORRECT_SOURCE_ACTION_ID>:' || a.user_id::text
 order by a.user_id;
```

The query must return exactly three rows, each with original credit
`1327.31132499` and latest completed package `500`. Save those three reviewed
user UUIDs, one per line, as `expected-doge-users.txt`. Keep production user
data outside version control. A user whose latest completed package is not
exactly `500` is rejected; this excludes a user who subsequently completed a
higher package.

## 2. Back up PostgreSQL

```bash
pg_dump --format=custom --no-owner --no-privileges --file="hb9-pre-doge-reversal-$(date +%Y%m%d-%H%M%S).dump" "$DATABASE_URL"
pg_restore --list hb9-pre-doge-reversal-YYYYMMDD-HHMMSS.dump > /dev/null
```

## 3. Dry run

Dry run uses a repeatable-read, read-only transaction and always rolls it back:

```bash
npm run hb:reverse-doge-dividend -- --source-action-id <INCORRECT_SOURCE_ACTION_ID> --expected-count 3 --expected-user-ids-file ./expected-doge-users.txt
```

It must report the exact three user IDs, latest completed package `500`,
current DOGE balance, original credit `1327.31132499`, deduction `1324` per
user, and total deduction `3972`.

## 4. Execute

Execute is rejected unless `--expected-count` is exactly `3`, the exact
three-user allowlist matches, and an operator manually confirms in an
interactive terminal:

```bash
npm run hb:reverse-doge-dividend -- --source-action-id <INCORRECT_SOURCE_ACTION_ID> --execute --expected-count 3 --expected-user-ids-file ./expected-doge-users.txt
```

Before asking for confirmation, the script prints the final three-user list
with `user_id`, wallet address, package amount, current DOGE balance, original
DOGE credited, and the 1324 DOGE deduction. It then requires the operator to
type this exact phrase:

```text
EXECUTE <INCORRECT_SOURCE_ACTION_ID> 3 USERS 3972 DOGE
```

Piped/non-interactive execution is rejected. After confirmation, the script
starts a serializable transaction and derives and validates the exact batch,
three users, allowlist, latest package, and balances again. Any drift from the
confirmed list aborts the transaction.

The operation uses a serializable transaction, locks the exact distribution and
affected DOGE balances, and aborts the entire transaction if any not-yet-
reversed user has less than 1324 DOGE. Each debit uses:

```text
doge-dividend-reversal:<SOURCE_ACTION_ID>:<USER_ID>:1324
```

## 5. Verify after execution

```sql
with affected as (
  select a.user_id,
         d.coin_amount as original_doge_credited,
         latest_package.amount_usd as latest_completed_package_usd
    from hb_admin_balance_actions a
    join hb_dividend_income_ledger d
      on d.source_action_id = a.id
     and d.coin_symbol = 'DOGE'
     and d.status = 'credited'
    join lateral (
      select p.amount_usd
        from hb_package_purchases p
       where p.user_id = a.user_id and p.status = 'completed'
       order by p.created_at desc, p.id desc
       limit 1
    ) latest_package on true
   where a.idempotency_key =
         'hb:funds:bulk:<INCORRECT_SOURCE_ACTION_ID>:' || a.user_id::text
)
select a.user_id,
       a.latest_completed_package_usd::text,
       a.original_doge_credited::text,
       b.balance::text as current_doge_balance,
       r.id as reversal_ledger_id,
       r.amount::text as reversed_doge,
       r.direction,
       r.type,
       r.note,
       r.idempotency_key,
       r.metadata,
       r.created_at
  from affected a
  left join hb_coin_balances b
    on b.user_id = a.user_id and b.coin_symbol = 'DOGE'
  left join hb_coin_balance_ledger r
    on r.idempotency_key =
       'doge-dividend-reversal:<INCORRECT_SOURCE_ACTION_ID>:' ||
       a.user_id::text || ':1324'
 order by a.user_id;
```

Verification must return exactly three users, all package `500`, each with one
`1324` DOGE debit. The reversal total must be exactly `3972`:

```sql
select count(*) as reversal_count, sum(amount)::text as total_reversed_doge
  from hb_coin_balance_ledger
 where idempotency_key like
       'doge-dividend-reversal:<INCORRECT_SOURCE_ACTION_ID>:%:1324';
```

## Rollback and recovery

Any error before commit automatically rolls back the complete operation. After
commit, never delete or edit the source or reversal ledgers. Recovery requires
a separately reviewed compensating transaction: create one idempotent 1324
DOGE credit per verified reversal, update `hb_coin_balances` through the same
locked balance pipeline, and create ledger proofs. Use:

```text
doge-dividend-reversal-recovery:<SOURCE_ACTION_ID>:<USER_ID>:1324
```

The recovery allowlist must be derived from the three verified reversal rows,
not from a broad package, DOGE, or date query. If integrity is uncertain, stop
writes and restore the pre-execution dump to an isolated database for
validation before considering any production restore.
