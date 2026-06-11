create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  poll_interval_seconds integer not null default 60,
  alert_cooldown_minutes integer not null default 45,
  stop_loss_threshold numeric not null default 0,
  volume_ratio_threshold numeric not null default 1.5,
  wechat_webhook_url text,
  browser_notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text not null,
  quantity numeric not null check (quantity > 0),
  cost_price numeric not null check (cost_price > 0),
  stop_loss_price numeric not null check (stop_loss_price > 0),
  watch_reason text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  index_name text not null,
  index_change_amount numeric,
  index_change_percent numeric not null,
  market_status text,
  net_inflow numeric,
  indices jsonb not null default '[]'::jsonb,
  rising_count integer not null,
  falling_count integer not null,
  total_turnover numeric not null,
  rising_count_change integer,
  falling_count_change integer,
  turnover_change_percent numeric,
  source_status text not null check (source_status in ('ok', 'stale', 'error')),
  captured_at timestamptz not null default now()
);

create table if not exists public.stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  price numeric not null,
  change_percent numeric not null,
  volume_ratio numeric not null default 1,
  captured_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text,
  level text not null check (level in ('info', 'warning', 'critical')),
  action text not null check (action in ('buy_watch', 'hold', 'reduce', 'stop_loss')),
  reason text not null,
  snapshot jsonb not null default '{}'::jsonb,
  delivered_channels text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.ocr_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null,
  parsed_holdings jsonb not null default '[]'::jsonb,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.holdings enable row level security;
alter table public.alerts enable row level security;
alter table public.ocr_imports enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "settings own rows" on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "holdings own rows" on public.holdings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alerts own rows" on public.alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ocr imports own rows" on public.ocr_imports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists holdings_user_active_idx on public.holdings (user_id, is_active);
create index if not exists stock_snapshots_symbol_captured_idx on public.stock_snapshots (symbol, captured_at desc);
create index if not exists market_snapshots_captured_idx on public.market_snapshots (captured_at desc);
create index if not exists alerts_user_created_idx on public.alerts (user_id, created_at desc);
