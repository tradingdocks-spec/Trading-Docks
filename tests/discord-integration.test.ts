import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { discordAuthorizeUrl, hashDiscordOAuthState } from "../src/lib/discord.ts";
import { getAccountAwareNavigationGroups } from "../src/components/dashboard/navigation.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("Discord navigation exposes one tenant-scoped integration route", () => {
  const groups = getAccountAwareNavigationGroups("store", false);
  const discord = groups.flatMap((group) => group.items).find((item) => item.href === "/dashboard/integrations/discord");
  assert.ok(discord);
  assert.equal(discord.label, "Discord");
  assert.equal(groups.flatMap((group) => group.items).filter((item) => item.href === "/dashboard/integrations/discord").length, 1);
});

test("OAuth state is hashed before persistence and is not workspace-controlled by the callback", () => {
  const connect = read("src/app/api/integrations/discord/connect/route.ts");
  const callback = read("src/app/api/integrations/discord/callback/route.ts");
  assert.match(connect, /createDiscordOAuthState/);
  assert.match(connect, /state_hash: state\.hash/);
  assert.match(callback, /hashDiscordOAuthState\(state\)/);
  assert.match(callback, /\.eq\("workspace_id", actor\.workspaceId\)/);
  assert.match(callback, /\.eq\("user_id", actor\.user\.id\)/);
  assert.match(callback, /consumed_at/);
});

test("OAuth state hash is deterministic and does not reveal the raw state", () => {
  const raw = "a".repeat(64);
  const hash = hashDiscordOAuthState(raw);
  assert.equal(hash.length, 64);
  assert.notEqual(hash, raw);
  assert.equal(hashDiscordOAuthState(raw), hash);
});

test("Discord authorization requests only server-configured application identity", () => {
  const previous = { id: process.env.DISCORD_APPLICATION_ID, redirect: process.env.DISCORD_REDIRECT_URI, site: process.env.NEXT_PUBLIC_SITE_URL };
  process.env.DISCORD_APPLICATION_ID = "app-test";
  process.env.DISCORD_REDIRECT_URI = "http://localhost:3000/api/integrations/discord/callback";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  const url = new URL(discordAuthorizeUrl("state-value"));
  assert.equal(url.searchParams.get("client_id"), "app-test");
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("scope"), "bot");
  if (previous.id === undefined) delete process.env.DISCORD_APPLICATION_ID; else process.env.DISCORD_APPLICATION_ID = previous.id;
  if (previous.redirect === undefined) delete process.env.DISCORD_REDIRECT_URI; else process.env.DISCORD_REDIRECT_URI = previous.redirect;
  if (previous.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = previous.site;
});

test("migration creates workspace-scoped tables, indexes, and RLS policies", () => {
  const migration = read("supabase/migrations/202609100004_discord_integration_v1.sql");
  for (const table of ["discord_integrations", "discord_channel_bindings", "discord_oauth_states", "discord_message_log"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, /alter table public\.discord_integrations enable row level security/);
  assert.match(migration, /is_workspace_discord_sender/);
  assert.match(migration, /unique \(workspace_id, guild_id\)/);
  assert.match(migration, /discord_integrations_workspace_status_idx/);
});

test("message endpoint validates a workspace channel binding instead of accepting a raw Discord channel", () => {
  const route = read("src/app/api/integrations/discord/messages/route.ts");
  assert.match(route, /discord_channel_bindings/);
  assert.match(route, /\.eq\("id", bindingId\)/);
  assert.match(route, /\.eq\("workspace_id", actor\.workspaceId\)/);
  assert.match(route, /binding\.discord_integration_id !== integration\.id/);
  assert.doesNotMatch(route, /body\.channelId/);
});

test("bot token is referenced only from server-side Discord code", () => {
  const discord = read("src/lib/discord.ts");
  const component = read("src/components/dashboard/integrations/DiscordIntegrationPage.tsx");
  assert.match(discord, /DISCORD_BOT_TOKEN/);
  assert.doesNotMatch(component, /DISCORD_BOT_TOKEN|DISCORD_CLIENT_SECRET/);
});

test("disconnect disables the integration and its authorized channels without deleting history", () => {
  const route = read("src/app/api/integrations/discord/disconnect/route.ts");
  assert.match(route, /status: "disconnected"/);
  assert.match(route, /discord_channel_bindings/);
  assert.doesNotMatch(route, /discord_message_log.*delete|from\("discord_message_log"\).*delete/);
});

test("manual V1 deliberately has no automatic inventory trigger or scheduler", () => {
  const component = read("src/components/dashboard/integrations/DiscordIntegrationPage.tsx");
  const migration = read("supabase/migrations/202609100004_discord_integration_v1.sql");
  assert.match(component, /sendMessage/);
  assert.match(component, /Choose recent inventory/);
  assert.doesNotMatch(migration, /pg_cron|schedule|inventory.*trigger/i);
});

test("channel discovery returns persisted binding field names to the UI", () => {
  const route = read("src/app/api/integrations/discord/channels/discover/route.ts");
  assert.match(route, /\.select\("id,channel_id,channel_name,purpose,enabled,can_view,can_send,can_embed,unavailable_reason"\)/);
  assert.match(route, /return NextResponse\.json\(\{ channels: bindings \?\? \[\] \}\)/);
  assert.match(route, /onConflict: "discord_integration_id,channel_id"/);
});

test("successful connection or channel refresh clears stale OAuth errors", () => {
  const component = read("src/components/dashboard/integrations/DiscordIntegrationPage.tsx");
  assert.match(component, /dismissedQueryError/);
  assert.match(component, /setDismissedQueryError\(true\)/);
  assert.match(component, /integration\?\.status === "connected" \|\| dismissedQueryError/);
});

test("channel authorization and purpose updates feed the authorized composer", () => {
  const route = read("src/app/api/integrations/discord/channels/route.ts");
  const component = read("src/components/dashboard/integrations/DiscordIntegrationPage.tsx");
  assert.match(route, /\.update\(\{ enabled: body\.enabled, purpose \}\)/);
  assert.match(route, /\.eq\("id", bindingId\).*\.eq\("workspace_id", actor\.workspaceId\)/s);
  assert.match(component, /option value="showcase">Showcase/);
  assert.match(component, /enabledChannels\.map\(\(channel\) => <option key=\{channel\.id\} value=\{channel\.id\}># \{channel\.channel_name\}/);
  assert.match(component, /aria-label=\{`Purpose for \$\{channel\.channel_name\}`\}/);
});

test("send button validates the selected binding and protects duplicate clicks", () => {
  const component = read("src/components/dashboard/integrations/DiscordIntegrationPage.tsx");
  assert.match(component, /Choose an authorized channel before sending\./);
  assert.match(component, /onClick=\{\(\) => void sendMessage\(\)\}/);
  assert.match(component, /disabled=\{busy === "send"\}/);
  assert.match(component, /setFeedback\(`Sent to #\$\{channel\.channel_name\}`\)/);
});

test("message endpoint maps Discord failures to safe actionable messages", () => {
  const route = read("src/app/api/integrations/discord/messages/route.ts");
  assert.match(route, /summary\.status === 401/);
  assert.match(route, /summary\.status === 403/);
  assert.match(route, /summary\.status === 404/);
  assert.match(route, /summary\.status === 429/);
  assert.match(route, /The bot cannot send messages to this channel/);
  assert.match(route, /Unable to send announcement/);
  assert.match(route, /status: "failed"/);
});
