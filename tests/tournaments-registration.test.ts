import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { apiAccessRuleForPath } from "../src/lib/platform/api-access.ts";
import { routeAccessRuleForPath } from "../src/lib/platform/route-access.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("tournament registration migration is additive and race-safe", () => {
  const migration = read("supabase/migrations/202609100005_tournament_registration_discord.sql");
  assert.match(migration, /alter table public\.tournaments add column if not exists/);
  assert.match(migration, /create table if not exists public\.tournament_registrations/);
  assert.match(migration, /for update/);
  assert.match(migration, /register_for_tournament/);
  assert.match(migration, /cancel_tournament_registration/);
  assert.match(migration, /target_tournament_id uuid/);
  assert.match(migration, /tournaments_max_players_check/);
  assert.match(migration, /public_registration_enabled/);
  assert.match(migration, /waitlist_enabled/);
  assert.match(migration, /is_workspace_tournament_staff/);
});

test("public tournament registration and staff routes are explicitly classified", () => {
  assert.equal(routeAccessRuleForPath("/events/friday-night-modern")?.kind, "public");
  assert.equal(apiAccessRuleForPath("/api/events/friday-night-modern/register")?.kind, "public");
  assert.equal(apiAccessRuleForPath("/api/dashboard/tournaments/tournament-id/registrations")?.capability, "events.manage");
});

test("public registration does not expose private registration fields", () => {
  const page = read("src/app/events/[tournamentSlug]/page.tsx");
  const component = read("src/components/tournaments/PublicTournamentRegistration.tsx");
  assert.doesNotMatch(page, /email|phone|discord_username|notes/);
  assert.match(component, /Your contact details are shared/);
  assert.match(component, /spots remaining|Tournament full|Join the waitlist/);
});

test("tournament detail reuses the Discord composer with canonical tournament identity", () => {
  const detail = read("src/components/tournaments/TournamentDetail.tsx");
  const discord = read("src/components/dashboard/integrations/DiscordIntegrationPage.tsx");
  const route = read("src/app/api/integrations/discord/messages/route.ts");
  assert.match(detail, /dashboard\/integrations\/discord/);
  assert.match(detail, /tournamentId/);
  assert.match(detail, /NEXT_PUBLIC_SITE_URL/);
  assert.match(discord, /prefill/);
  assert.match(discord, /tournamentId: prefill\?\.tournamentId/);
  assert.match(route, /tournament_id: tournamentId/);
});

test("registration API delegates capacity decisions to the database function", () => {
  const route = read("src/app/api/events/[tournamentSlug]/register/route.ts");
  assert.match(route, /register_for_tournament/);
  assert.doesNotMatch(route, /from\("tournament_registrations"\)\.insert/);
  assert.match(route, /playerName/);
  assert.match(read("src/components/tournaments/PublicTournamentRegistration.tsx"), /registrationSource/);
});
