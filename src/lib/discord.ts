import { createHash, randomBytes } from "node:crypto";

const DISCORD_API = "https://discord.com/api/v10";
const VIEW_CHANNEL = 1 << 10;
const SEND_MESSAGES = 1 << 11;
const EMBED_LINKS = 1 << 14;
const ADMINISTRATOR = 1 << 3;

export const DISCORD_ANNOUNCEMENT_TYPES = [
  "general",
  "tournament",
  "deal",
  "new_arrival",
  "restock",
  "showcase",
  "buylist",
  "test",
] as const;

export type DiscordAnnouncementType = (typeof DISCORD_ANNOUNCEMENT_TYPES)[number];

type DiscordGuild = { id: string; name: string; icon?: string | null };
type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
};
type DiscordRole = { id: string; permissions: string };

export type WritableDiscordChannel = {
  id: string;
  name: string;
  canView: boolean;
  canSend: boolean;
  canEmbed: boolean;
  unavailableReason: string | null;
};

export class DiscordApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
  ) {
    super(message);
    this.name = "DiscordApiError";
    this.status = status;
    this.code = code;
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function discordIsConfigured() {
  return Boolean(
    process.env.DISCORD_APPLICATION_ID?.trim() &&
      process.env.DISCORD_CLIENT_SECRET?.trim() &&
      process.env.DISCORD_BOT_TOKEN?.trim(),
  );
}

function botToken() {
  return requiredEnv("DISCORD_BOT_TOKEN");
}

function applicationId() {
  return requiredEnv("DISCORD_APPLICATION_ID");
}

function redirectUri() {
  return (
    process.env.DISCORD_REDIRECT_URI?.trim() ||
    `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/api/integrations/discord/callback`
  );
}

export function createDiscordOAuthState() {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashDiscordOAuthState(raw) };
}

export function hashDiscordOAuthState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function discordAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: applicationId(),
    scope: "bot applications.commands",
    permissions: String(Number(VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS)),
    response_type: "code",
    redirect_uri: redirectUri(),
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function discordRedirectUri() {
  return redirectUri();
}

export function discordGuildIconUrl(guildId: string, icon: string | null | undefined) {
  return icon ? `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=128` : null;
}

async function discordRequest<T>(path: string, options: RequestInit = {}, token = botToken()): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const message = typeof record.message === "string" ? record.message : "Discord API request failed.";
    const code = typeof record.code === "number" ? String(record.code) : null;
    throw new DiscordApiError(message, response.status, code);
  }
  return body as T;
}

export async function exchangeDiscordCode(code: string) {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: applicationId(),
      client_secret: requiredEnv("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = typeof body?.error_description === "string" ? body.error_description : "Discord authorization failed.";
    throw new DiscordApiError(message, response.status, typeof body?.error === "string" ? body.error : null);
  }
  const guild = body?.guild && typeof body.guild === "object" ? body.guild as Record<string, unknown> : null;
  const guildId = typeof guild?.id === "string" ? guild.id : null;
  if (!guildId) throw new DiscordApiError("Discord did not return an installed server.", 422, "missing_guild");
  return {
    guild: {
      id: guildId,
      name: typeof guild?.name === "string" ? guild.name : "Discord server",
      icon: typeof guild?.icon === "string" ? guild.icon : null,
    } satisfies DiscordGuild,
  };
}

export async function fetchDiscordGuild(guildId: string) {
  return discordRequest<DiscordGuild>(`/guilds/${encodeURIComponent(guildId)}`);
}

function permissionsForChannel(
  guildId: string,
  botUserId: string,
  botRoleIds: Set<string>,
  roles: DiscordRole[],
  overwrites: DiscordChannel["permission_overwrites"],
) {
  const everyone = roles.find((role) => role.id === guildId);
  let permissions = Number(everyone?.permissions ?? "0");
  for (const role of roles) {
    if (role.id !== guildId && botRoleIds.has(role.id)) permissions |= Number(role.permissions);
  }
  if (permissions & ADMINISTRATOR) return permissions;
  const overrides = overwrites ?? [];
  const everyoneOverride = overrides.find((override) => override.id === guildId && override.type === 0);
  if (everyoneOverride) {
    permissions = (permissions & ~Number(everyoneOverride.deny)) | Number(everyoneOverride.allow);
  }
  let roleAllow = 0;
  let roleDeny = 0;
  for (const override of overrides) {
    if (override.type === 0 && botRoleIds.has(override.id)) {
      roleAllow |= Number(override.allow);
      roleDeny |= Number(override.deny);
    }
  }
  permissions = (permissions & ~roleDeny) | roleAllow;
  const memberOverride = overrides.find((override) => override.type === 1 && override.id === botUserId);
  if (memberOverride) permissions = (permissions & ~Number(memberOverride.deny)) | Number(memberOverride.allow);
  return permissions;
}

export async function fetchWritableDiscordChannels(guildId: string): Promise<WritableDiscordChannel[]> {
  const [guildChannels, roles, botUser] = await Promise.all([
    discordRequest<DiscordChannel[]>(`/guilds/${encodeURIComponent(guildId)}/channels`),
    discordRequest<DiscordRole[]>(`/guilds/${encodeURIComponent(guildId)}/roles`),
    discordRequest<{ id: string }>("/users/@me"),
  ]);
  const botMember = await discordRequest<{ roles: string[] }>(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(botUser.id)}`);
  const roleIds = new Set(botMember.roles);
  roleIds.add(guildId);
  return guildChannels
    .filter((channel) => channel.type === 0 || channel.type === 5)
    .map((channel) => {
      const permissions = permissionsForChannel(guildId, botUser.id, roleIds, roles, channel.permission_overwrites);
      const canView = Boolean(permissions & VIEW_CHANNEL);
      const canSend = Boolean(permissions & SEND_MESSAGES);
      const canEmbed = Boolean(permissions & EMBED_LINKS);
      return {
        id: channel.id,
        name: channel.name,
        canView,
        canSend,
        canEmbed,
        unavailableReason: !canView
          ? "The Trading Docks bot cannot view this channel."
          : !canSend
            ? "The Trading Docks bot cannot send messages here."
            : !canEmbed
              ? "The bot can send text, but embeds are unavailable."
              : null,
      };
    });
}

export async function sendDiscordMessage(
  channelId: string,
  payload: { content: string; embeds?: Array<Record<string, unknown>> },
) {
  return discordRequest<{ id: string }>(`/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function discordErrorSummary(error: unknown) {
  if (error instanceof DiscordApiError) return { status: error.status, code: error.code, message: error.message };
  return { status: 500, code: null, message: error instanceof Error ? error.message : "Unknown Discord error." };
}
