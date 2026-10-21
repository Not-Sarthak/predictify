-- Counters on "Users" were updated by reading the row, adding in node, and writing the sum back,
-- so two concurrent writers lost one of their increments. These functions do the addition inside
-- a single UPDATE / INSERT ... ON CONFLICT, which postgres serialises per row.

create or replace function public.increment_user_stats(
    p_user_id bigint,
    p_amount_deposited double precision default 0,
    p_fees_total double precision default 0,
    p_markets_traded integer default 0,
    p_txns_executed integer default 0,
    p_total_volume double precision default 0,
    p_total_pnl double precision default 0,
    p_number_of_referrals integer default 0
)
returns void
language sql
as $$
    update public."Users"
    set
        amount_deposited = coalesce(amount_deposited, 0) + p_amount_deposited,
        fees_total = coalesce(fees_total, 0) + p_fees_total,
        markets_traded = coalesce(markets_traded, 0) + p_markets_traded,
        txns_executed = coalesce(txns_executed, 0) + p_txns_executed,
        total_volume = coalesce(total_volume, 0) + p_total_volume,
        total_pnl = coalesce(total_pnl, 0) + p_total_pnl,
        number_of_referrals = coalesce(number_of_referrals, 0) + p_number_of_referrals
    where id = p_user_id;
$$;

-- The upserts below need one row per user and period. If either index fails to build, the table
-- already holds duplicates from the old select-then-insert path; merge them before re-running.
create unique index if not exists "Weekly_Active_Users_user_year_week_key"
    on public."Weekly_Active_Users" (user_id, year, week_number);

create unique index if not exists "Monthly_Active_Users_user_year_month_key"
    on public."Monthly_Active_Users" (user_id, year, month_number);

create or replace function public.record_user_activity(
    p_user_id bigint,
    p_year integer,
    p_week_number integer,
    p_week_start timestamptz,
    p_month_number integer,
    p_month_start timestamptz
)
returns void
language sql
as $$
    insert into public."Weekly_Active_Users" (user_id, year, week_number, week_start, transaction_count)
    values (p_user_id, p_year, p_week_number, p_week_start, 1)
    on conflict (user_id, year, week_number)
    do update set transaction_count = coalesce("Weekly_Active_Users".transaction_count, 0) + 1;

    insert into public."Monthly_Active_Users" (user_id, year, month_number, month_start, transaction_count)
    values (p_user_id, p_year, p_month_number, p_month_start, 1)
    on conflict (user_id, year, month_number)
    do update set transaction_count = coalesce("Monthly_Active_Users".transaction_count, 0) + 1;
$$;
