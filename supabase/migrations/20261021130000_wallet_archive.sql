-- Resetting a wallet overwrote the user's encrypted keys in place, so anything still held by the old
-- Polygon or Solana wallet became unrecoverable. The old keys are archived here first.

create table if not exists public."Wallet_Archive" (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null references public."Users" (id),
    wallet_address text not null,
    private_key text not null,
    solana_address text,
    solana_private_key text,
    api_credentials text,
    archived_at timestamptz not null default now()
);

create index if not exists "Wallet_Archive_user_id_idx" on public."Wallet_Archive" (user_id);

-- Only the service role (which bypasses RLS) should ever read encrypted keys
alter table public."Wallet_Archive" enable row level security;
