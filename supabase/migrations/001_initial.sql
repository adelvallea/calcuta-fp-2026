-- ============================================================
-- Calcuta Mundial 2026 — Schema inicial
-- ============================================================

-- Settings globales de la calcuta
create table if not exists calcuta_settings (
  id uuid primary key default gen_random_uuid(),
  event_name text not null default 'Gran Calcuta · Mundial 2026',
  buy_in_amount numeric(10,2) not null default 1000,
  min_bid_increment numeric(10,2) not null default 200,
  currency text not null default 'MXN',
  currency_symbol text not null default '$',
  auction_started boolean not null default false,
  auction_finished boolean not null default false,
  current_lot_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Participantes
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  buy_in_amount numeric(10,2) not null default 1000,
  amount_paid numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- Equipos
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(3) not null,
  fifa_rank integer not null,
  pot integer not null check (pot between 1 and 4),
  best_world_cup text not null default '',
  world_cup_2022 text not null default '',
  confederation text not null,
  group_wc2026 text,
  current_status text not null default 'not_started',
  final_position integer,
  current_points integer not null default 0,
  current_goal_diff integer not null default 0,
  matches_played integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0
);

-- Lotes de subasta
create table if not exists lots (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  title text not null,
  type text not null check (type in ('solo', 'combo')),
  status text not null default 'pending' check (status in ('pending', 'active', 'sold', 'paused', 'cancelled')),
  current_bid numeric(10,2) not null default 0,
  final_price numeric(10,2),
  notes text,
  created_at timestamptz not null default now()
);

-- Equipos por lote (many-to-many)
create table if not exists lot_teams (
  lot_id uuid not null references lots(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (lot_id, team_id)
);

-- Bids / pujas
create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now(),
  created_by text not null default 'admin'
);

-- Copropiedad de lotes
create table if not exists lot_ownerships (
  lot_id uuid not null references lots(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  ownership_percentage numeric(5,2) not null check (ownership_percentage > 0 and ownership_percentage <= 100),
  primary key (lot_id, participant_id)
);

-- Pagos registrados
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  amount numeric(10,2) not null,
  method text,
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- Reglas de premios (editables)
create table if not exists prize_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  final_position integer not null,
  percentage numeric(5,2) not null,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

-- Sponsors / aportaciones adicionales a la bolsa
create table if not exists sponsor_contributions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(10,2) not null,
  included_in_pool boolean not null default true,
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Partidos del Mundial
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  kickoff timestamptz,
  stage text not null,
  group_name text,
  source text not null default 'manual',
  updated_at timestamptz not null default now()
);

-- Clasificación final del torneo (para calcular premios)
create table if not exists tournament_standings (
  team_id uuid primary key references teams(id),
  position integer,
  source text not null default 'manual',
  updated_at timestamptz not null default now()
);

-- Audit log
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_value jsonb,
  new_value jsonb,
  performed_by text not null default 'admin',
  created_at timestamptz not null default now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
create index if not exists bids_lot_id_idx on bids(lot_id);
create index if not exists bids_participant_id_idx on bids(participant_id);
create index if not exists bids_created_at_idx on bids(created_at desc);
create index if not exists lot_ownerships_participant_id_idx on lot_ownerships(participant_id);
create index if not exists payments_participant_id_idx on payments(participant_id);
create index if not exists teams_fifa_rank_idx on teams(fifa_rank);
create index if not exists lots_number_idx on lots(number);
create index if not exists lots_status_idx on lots(status);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Habilita realtime en las tablas que necesitan actualizaciones en vivo
alter publication supabase_realtime add table bids;
alter publication supabase_realtime add table lots;
alter publication supabase_realtime add table lot_ownerships;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table teams;

-- ─── Row Level Security (permisivo para MVP — ajustar en producción) ──────────
alter table calcuta_settings enable row level security;
alter table participants enable row level security;
alter table teams enable row level security;
alter table lots enable row level security;
alter table lot_teams enable row level security;
alter table bids enable row level security;
alter table lot_ownerships enable row level security;
alter table payments enable row level security;
alter table prize_rules enable row level security;
alter table sponsor_contributions enable row level security;
alter table matches enable row level security;
alter table tournament_standings enable row level security;
alter table audit_logs enable row level security;

-- Política permisiva para anon (MVP — en producción limitar a roles)
create policy "allow_all_anon" on calcuta_settings for all using (true) with check (true);
create policy "allow_all_anon" on participants for all using (true) with check (true);
create policy "allow_all_anon" on teams for all using (true) with check (true);
create policy "allow_all_anon" on lots for all using (true) with check (true);
create policy "allow_all_anon" on lot_teams for all using (true) with check (true);
create policy "allow_all_anon" on bids for all using (true) with check (true);
create policy "allow_all_anon" on lot_ownerships for all using (true) with check (true);
create policy "allow_all_anon" on payments for all using (true) with check (true);
create policy "allow_all_anon" on prize_rules for all using (true) with check (true);
create policy "allow_all_anon" on sponsor_contributions for all using (true) with check (true);
create policy "allow_all_anon" on matches for all using (true) with check (true);
create policy "allow_all_anon" on tournament_standings for all using (true) with check (true);
create policy "allow_all_anon" on audit_logs for all using (true) with check (true);
