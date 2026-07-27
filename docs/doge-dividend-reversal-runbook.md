# One-time DOGE dividend reversal

This runbook debits exactly 1543 DOGE from each user identified by the original
credited dividend rows for one exact `source_action_id`. Replace placeholders
below only after independently confirming the incorrect run. Do not use a date
or a broad DOGE-only filter.

## 1. Confirm the exact incorrect source action

```sql
select d.source_action_id,
       a.type as source_action_type,
       a.coin_symbol,
       a.amount::text as source_action_amount,
       a.note,
       count(*) filter (where d.status = 'credited') as credited_row_count,
       count(distinct d.user_id) filter (where d.status = 'credited') as affected_user_count,
       min(d.created_at) as first_credit_at,
       max(d.created_at) as last_credit_at
  from hb_dividend_income_ledger d
  left join hb_admin_balance_actions a on a.id = d.source_action_id
 where d.source_action_id = '<INCORRECT_SOURCE_ACTION_ID>'::uuid
   and d.coin_symbol = 'DOGE'
 group by d.source_action_id, a.type, a.coin_symbol, a.amount, a.note;
```

Review the source action, note, amount, timestamps, count, and exact users:

```sql
select d.user_id, d.id as dividend_ledger_id, d.coin_amount::text, d.status, d.note
  from hb_dividend_income_ledger d
 where d.source_action_id = '<INCORRECT_SOURCE_ACTION_ID>'::uuid
   and d.coin_symbol = 'DOGE'
   and d.status = 'credited'
 order by d.user_id;
```

Save the reviewed user IDs, one UUID per line, as `expected-doge-users.txt`.
The file is a mandatory execute-mode allowlist and must exactly match the
source rows. Keep it outside version control if it contains production data.

## 2. Back up PostgreSQL before production execution

```bash
pg_dump --format=custom --no-owner --no-privileges --file="hb9-pre-doge-reversal-$(date +%Y%m%d-%H%M%S).dump" "$DATABASE_URL"
```

Verify the dump before proceeding:

```bash
pg_restore --list hb9-pre-doge-reversal-YYYYMMDD-HHMMSS.dump > /dev/null
```

## 3. Dry run

Dry run uses a repeatable-read, read-only transaction and always rolls it back.

```bash
npm run hb:reverse-doge-dividend -- --source-action-id <INCORRECT_SOURCE_ACTION_ID>
```

For an additional allowlist/count check:

```bash
npm run hb:reverse-doge-dividend -- --source-action-id <INCORRECT_SOURCE_ACTION_ID> --expected-count <COUNT> --expected-user-ids-file ./expected-doge-users.txt
```

## 4. Execute

Execute requires both the reviewed count and exact user allowlist:

```bash
npm run hb:reverse-doge-dividend -- --source-action-id <INCORRECT_SOURCE_ACTION_ID> --execute --expected-count <COUNT> --expected-user-ids-file ./expected-doge-users.txt
```

The operation is serializable and transactional. It locks the run and affected
DOGE balances, aborts the entire transaction if any not-yet-reversed user has
less than 1543 DOGE, inserts a debit ledger row, updates the normal coin balance
table, creates its ledger proof, and commits only after every user succeeds.
Existing source ledgers are never updated or deleted.

## 5. Verify after execution

```sql
with affected as (
  select distinct user_id
    from hb_dividend_income_ledger
   where source_action_id = '<INCORRECT_SOURCE_ACTION_ID>'::uuid
     and coin_symbol = 'DOGE'
     and status = 'credited'
)
select a.user_id,
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
       a.user_id::text || ':1543'
 order by a.user_id;
```

The result must contain exactly one reversal per affected user, each with
`amount = 1543`, `direction = debit`, and no missing `reversal_ledger_id`.

## Rollback and recovery

Before commit, any error automatically rolls the entire transaction back.
After commit, do not delete or edit either original or reversal ledger rows.
Recovery must be a separately reviewed compensating transaction: create one
idempotent 1543 DOGE credit ledger entry per verified reversal, update
`hb_coin_balances` through the same locked balance pipeline, and create proofs.
Use a distinct key such as
`doge-dividend-reversal-recovery:<SOURCE_ACTION_ID>:<USER_ID>:1543`.
If ledger integrity is uncertain, stop writes and restore the pre-execution dump
to an isolated database first; validate it there before any production restore.
