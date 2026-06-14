do $$
declare
  price_table record;
begin
  for price_table in
    select symbol_column.table_schema, symbol_column.table_name
    from information_schema.columns symbol_column
    join information_schema.columns price_column
      on price_column.table_schema = symbol_column.table_schema
     and price_column.table_name = symbol_column.table_name
     and price_column.column_name = 'usd_price'
    where symbol_column.column_name = 'symbol'
      and symbol_column.table_schema = current_schema()
  loop
    execute format(
      'update %I.%I set usd_price = $1 where upper(symbol::text) = ''HB9''',
      price_table.table_schema,
      price_table.table_name
    ) using 0.90;
  end loop;
end
$$;

alter table if exists hb_coin_conversions
  alter column hb9_price_used set default 0.90;
