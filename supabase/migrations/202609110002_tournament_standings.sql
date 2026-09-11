-- Tournament Operations PR 3: standings derived from authoritative match history.
-- No standings snapshot is stored; corrections are reflected on the next read.
-- Formulas: win = 3 match points, draw = 1, loss = 0; a bye is a win with no opponent edge.
-- GW% = game wins / (game wins + game losses + game draws), floored at 0.33 and capped at 1.00.
-- OMW% = average opponent match win percentage, with each opponent rate calculated as
-- match points / (3 * completed matches), floored at 0.33 and capped at 1.00.
-- OGW% = average opponent GW%, using the same 0.33 floor. Ranking is points, OMW%, GW%, OGW%, seed, id.

create or replace function public.get_tournament_standings(target_tournament_id uuid)
returns table (
  rank bigint, player_id uuid, display_name text, player_status text, seed_order integer,
  match_points integer, match_wins integer, match_losses integer, match_draws integer,
  game_wins integer, game_losses integer, game_draws integer, omw numeric, gw numeric, ogw numeric
)
language sql security definer set search_path = ''
as $$
with player_rows as (
  select p.id, p.display_name, p.player_status, p.seed_order
  from public.tournament_players p
  where p.tournament_id = target_tournament_id
    and (exists (select 1 from public.tournaments t where t.id = p.tournament_id and t.status = 'published' and t.public_registration_enabled = true)
      or public.is_workspace_member((select t.workspace_id from public.tournaments t where t.id = p.tournament_id)))
), completed_matches as (
  select m.* from public.tournament_matches m
  where m.tournament_id = target_tournament_id and m.result_status in ('reported', 'corrected')
), sides as (
  select m.player_one_id as player_id, m.player_two_id as opponent_id,
    case when m.is_bye then 3 when m.player_one_games_won = m.player_two_games_won then 1 when m.player_one_games_won > m.player_two_games_won then 3 else 0 end as match_points,
    case when m.is_bye or m.player_one_games_won > m.player_two_games_won then 1 else 0 end as match_wins,
    case when not m.is_bye and m.player_one_games_won < m.player_two_games_won then 1 else 0 end as match_losses,
    case when not m.is_bye and m.player_one_games_won = m.player_two_games_won then 1 else 0 end as match_draws,
    m.player_one_games_won as game_wins, m.player_two_games_won as game_losses, m.game_draws
  from completed_matches m
  union all
  select m.player_two_id, m.player_one_id,
    case when m.player_two_games_won = m.player_one_games_won then 1 when m.player_two_games_won > m.player_one_games_won then 3 else 0 end,
    case when m.player_two_games_won > m.player_one_games_won then 1 else 0 end,
    case when m.player_two_games_won < m.player_one_games_won then 1 else 0 end,
    case when m.player_two_games_won = m.player_one_games_won then 1 else 0 end,
    m.player_two_games_won, m.player_one_games_won, m.game_draws
  from completed_matches m where m.player_two_id is not null and not m.is_bye
), totals as (
  select p.id, p.display_name, p.player_status, p.seed_order,
    coalesce(sum(s.match_points), 0)::integer as match_points, coalesce(sum(s.match_wins), 0)::integer as match_wins,
    coalesce(sum(s.match_losses), 0)::integer as match_losses, coalesce(sum(s.match_draws), 0)::integer as match_draws,
    coalesce(sum(s.game_wins), 0)::integer as game_wins, coalesce(sum(s.game_losses), 0)::integer as game_losses, coalesce(sum(s.game_draws), 0)::integer as game_draws
  from player_rows p left join sides s on s.player_id = p.id group by p.id, p.display_name, p.player_status, p.seed_order
), with_rates as (
  select t.*, greatest(0.33, least(1, coalesce(t.game_wins::numeric / nullif(t.game_wins + t.game_losses + t.game_draws, 0), 0))) as gw,
    greatest(0.33, least(1, coalesce((select avg(greatest(0.33, least(1, o.match_points::numeric / nullif(3 * (o.match_wins + o.match_losses + o.match_draws), 0)))) from sides s join totals o on o.id = s.opponent_id where s.player_id = t.id and s.opponent_id is not null), 0))) as omw,
    greatest(0.33, least(1, coalesce((select avg(o.gw) from sides s join (select t2.id, greatest(0.33, least(1, coalesce(t2.game_wins::numeric / nullif(t2.game_wins + t2.game_losses + t2.game_draws, 0), 0))) as gw from totals t2) o on o.id = s.opponent_id where s.player_id = t.id and s.opponent_id is not null), 0))) as ogw
  from totals t
)
select row_number() over (order by match_points desc, omw desc, gw desc, ogw desc, seed_order, id), id, display_name, player_status, seed_order,
  match_points, match_wins, match_losses, match_draws, game_wins, game_losses, game_draws, omw, gw, ogw
from with_rates order by match_points desc, omw desc, gw desc, ogw desc, seed_order, id;
$$;

revoke all on function public.get_tournament_standings(uuid) from public;
grant execute on function public.get_tournament_standings(uuid) to authenticated, anon;
