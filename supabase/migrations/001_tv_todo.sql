-- Tabelas do dash de TO-DO da TV
create table if not exists public.tv_daily (
  dia date primary key,
  texto text not null,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.tv_ticks (
  dia date not null,
  chave text not null,
  feito boolean not null default true,
  atualizado_em timestamptz not null default now(),
  primary key (dia, chave)
);
create table if not exists public.tv_monday_cache (
  id int primary key default 1 check (id = 1),
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.tv_daily enable row level security;
alter table public.tv_ticks enable row level security;
alter table public.tv_monday_cache enable row level security;
create policy "tv_daily leitura" on public.tv_daily for select to anon, authenticated using (true);
create policy "tv_daily insere" on public.tv_daily for insert to anon, authenticated with check (true);
create policy "tv_daily altera" on public.tv_daily for update to anon, authenticated using (true) with check (true);
create policy "tv_ticks leitura" on public.tv_ticks for select to anon, authenticated using (true);
create policy "tv_ticks insere" on public.tv_ticks for insert to anon, authenticated with check (true);
create policy "tv_ticks altera" on public.tv_ticks for update to anon, authenticated using (true) with check (true);
create policy "tv_monday leitura" on public.tv_monday_cache for select to anon, authenticated using (true);
grant select, insert, update on public.tv_daily, public.tv_ticks to anon, authenticated;
grant select on public.tv_monday_cache to anon, authenticated;
