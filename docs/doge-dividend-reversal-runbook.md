# One-time DOGE dividend reversal

This operation is pinned to three reviewed production
`source_action_id`/`user_id` pairs. It deducts exactly 1324 DOGE from each user
(3972 DOGE total) without changing any original credit or dividend row.

## 1. Create the reviewed manifest

Create an untracked file such as `doge-reversal-manifest.csv` containing exactly:

```csv
ebb6da48-ffc2-4ca7-9261-d78794a3f459,6158ae4c-f2fc-4306-8744-b6908fa95533,1327.31132499
8c1a45b7-0350-4e7c-b832-b4c163d90b83,88eb56d7-6263-45c0-aa92-c7d039ee0e92,1327.31132499
ca07e8c0-8e66-4716-b0c8-9ba843a1884b,96818662-0fa5-4164-a298-8c38f72d3df6,1427.67036250
```

The columns are:

```text
source_action_id,user_id,expected_original_coin_amount
```

JSON is also accepted as an array (or an object with a `rows` array):

```json
[
  {
    "source_action_id": "ebb6da48-ffc2-4ca7-9261-d78794a3f459",
    "user_id": "6158ae4c-f2fc-4306-8744-b6908fa95533",
    "expected_original_coin_amount": "1327.31132499"
  },
  {
    "source_action_id": "8c1a45b7-0350-4e7c-b832-b4c163d90b83",
    "user_id": "88eb56d7-6263-45c0-aa92-c7d039ee0e92",
    "expected_original_coin_amount": "1327.31132499"
  },
  {
    "source_action_id": "ca07e8c0-8e66-4716-b0c8-9ba843a1884b",
    "user_id": "96818662-0fa5-4164-a298-8c38f72d3df6",
    "expected_original_coin_amount": "1427.67036250"
  }
]
```

The script rejects any manifest that is not exactly equal to these confirmed
rows. It also requires three distinct users and three distinct source actions.

## 2. Confirm the source rows

This exact-pair query must return three rows:

```sql
with manifest(source_action_id, user_id, expected_amount) as (
  values
    ('ebb6da48-ffc2-4ca7-9261-d78794a3f459'::uuid,
     '6158ae4c-f2fc-4306-8744-b6908fa95533'::uuid, 1327.31132499::numeric),
    ('8c1a45b7-0350-4e7c-b832-b4c163d90b83'::uuid,
     '88eb56d7-6263-45c0-aa92-c7d039ee0e92'::uuid, 1327.31132499::numeric),
    ('ca07e8c0-8e66-4716-b0c8-9ba843a1884b'::uuid,
     '96818662-0fa5-4164-a298-8c38f72d3df6'::uuid, 1427.67036250::numeric)
)
select m.source_action_id,
       m.user_id,
       d.id as dividend_ledger_id,
       d.coin_symbol,
       d.status,
       d.note,
       d.coin_amount::text as original_doge_credit,
       d.package_total_usd::text as package_usd,
       (select count(*)
          from hb_dividend_income_ledger x
         where x.source_action_id = m.source_action_id) as source_row_count
  from manifest m
  left join hb_dividend_income_ledger d
    on d.source_action_id = m.source_action_id
   and d.user_id = m.user_id
   and d.coin_symbol = 'DOGE'
   and d.status = 'credited'
   and lower(btrim(d.note)) = 'dividend'
   and d.coin_amount = m.expected_amount
 order by m.user_id;
```

Each source action must have `source_row_count = 1`; the sole row must match
the specified user, DOGE, `credited`, note `Dividend`, expected amount, and
historical dividend-row `package_total_usd = 500`. Later package purchases are
not used to validate this historical distribution.

## 3. Back up PostgreSQL

```bash
pg_dump --format=custom --no-owner --no-privileges --file="hb9-pre-doge-reversal-$(date +%Y%m%d-%H%M%S).dump" "$DATABASE_URL"
pg_restore --list hb9-pre-doge-reversal-YYYYMMDD-HHMMSS.dump > /dev/null
```

## 4. Dry run

```bash
npm run hb:reverse-doge-dividend -- --manifest ./doge-reversal-manifest.csv
```

Dry run uses a repeatable-read, read-only transaction and always rolls it back.
It prints source action, user, wallet address, historical package amount, original DOGE
credit, current DOGE balance, deduction 1324, and total deduction 3972.

## 5. Execute

```bash
npm run hb:reverse-doge-dividend -- --manifest ./doge-reversal-manifest.csv --execute
```

The script first performs and prints the read-only preflight. It then requires
an interactive operator to type exactly:

```text
EXECUTE 3 USERS 3 ACTIONS 3972 DOGE
```

Non-interactive execution is rejected. After confirmation, one serializable
transaction locks all three user balances, revalidates the manifest and
database rows, creates any missing reversal ledger entries, updates balances,
creates ledger proofs, and commits. Any mismatch or balance below 1324 aborts
the entire transaction.

Each reversal has this deterministic key:

```text
doge-dividend-reversal:<SOURCE_ACTION_ID>:<USER_ID>:1324
```

Re-running cannot insert a duplicate key or deduct a second time.

## 6. Verify after execution

```sql
with manifest(source_action_id, user_id, expected_amount) as (
  values
    ('ebb6da48-ffc2-4ca7-9261-d78794a3f459'::uuid,
     '6158ae4c-f2fc-4306-8744-b6908fa95533'::uuid, 1327.31132499::numeric),
    ('8c1a45b7-0350-4e7c-b832-b4c163d90b83'::uuid,
     '88eb56d7-6263-45c0-aa92-c7d039ee0e92'::uuid, 1327.31132499::numeric),
    ('ca07e8c0-8e66-4716-b0c8-9ba843a1884b'::uuid,
     '96818662-0fa5-4164-a298-8c38f72d3df6'::uuid, 1427.67036250::numeric)
)
select m.source_action_id,
       m.user_id,
       m.expected_amount::text as original_doge_credit,
       b.balance::text as current_doge_balance,
       r.id as reversal_ledger_id,
       r.amount::text as reversed_doge,
       r.direction,
       r.type,
       r.note,
       r.idempotency_key,
       r.metadata,
       r.created_at
  from manifest m
  left join hb_coin_balances b
    on b.user_id = m.user_id and b.coin_symbol = 'DOGE'
  left join hb_coin_balance_ledger r
    on r.idempotency_key =
       'doge-dividend-reversal:' || m.source_action_id::text || ':' ||
       m.user_id::text || ':1324'
 order by m.user_id;
```

Aggregate verification:

```sql
with expected_keys(idempotency_key) as (
  values
    ('doge-dividend-reversal:ebb6da48-ffc2-4ca7-9261-d78794a3f459:6158ae4c-f2fc-4306-8744-b6908fa95533:1324'),
    ('doge-dividend-reversal:8c1a45b7-0350-4e7c-b832-b4c163d90b83:88eb56d7-6263-45c0-aa92-c7d039ee0e92:1324'),
    ('doge-dividend-reversal:ca07e8c0-8e66-4716-b0c8-9ba843a1884b:96818662-0fa5-4164-a298-8c38f72d3df6:1324')
)
select count(r.id) as reversal_count,
       coalesce(sum(r.amount), 0)::text as total_reversed_doge,
       count(*) filter (where r.id is null) as missing_reversals
  from expected_keys e
  left join hb_coin_balance_ledger r on r.idempotency_key = e.idempotency_key;
```

Expected result: `reversal_count = 3`, `total_reversed_doge = 3972`, and
`missing_reversals = 0`.

## Rollback and recovery

Any error before commit automatically rolls back all three users. After commit,
never delete or edit original or reversal ledger rows. Recovery must be a
separately reviewed compensating serializable transaction derived only from the
three exact reversal keys above. Create one 1324 DOGE credit per reversal,
update the locked coin balance through the normal pipeline, and create proofs.

Use recovery keys:

```text
doge-dividend-reversal-recovery:<SOURCE_ACTION_ID>:<USER_ID>:1324
```

If integrity is uncertain, stop writes and restore the pre-execution dump to an
isolated database for validation before considering any production restore.
