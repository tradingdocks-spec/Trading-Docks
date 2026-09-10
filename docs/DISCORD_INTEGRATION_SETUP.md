# Discord Integration V1 setup

Trading Docks uses one centrally managed Discord application. Each workspace installs that application into its own Discord server and then authorizes individual channels inside Trading Docks.

## Discord Developer Portal

1. Create or use the Trading Docks Discord application.
2. Copy the application/client ID and client secret into the server environment.
3. Create the bot user and copy its token into `DISCORD_BOT_TOKEN`.
4. Add the redirect URI for every environment:
   - Local: `http://localhost:3000/api/integrations/discord/callback`
   - Production: `https://www.tradingdocks.com/api/integrations/discord/callback`
5. The Trading Docks Connect button requests only the `bot` scope and the minimum bot permissions needed for V1: View Channel, Send Messages, and Embed Links. V1 does not use slash commands.

## Server configuration

Set these values in Vercel and local development as appropriate:

- `DISCORD_APPLICATION_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_REDIRECT_URI`
- `NEXT_PUBLIC_SITE_URL`

The bot token and client secret are server-only values. They are never returned to browser code or stored in Supabase.

## Database

Apply `supabase/migrations/202609100004_discord_integration_v1.sql` after the existing auth/workspace migrations. The migration creates workspace-scoped integration, channel binding, OAuth state, and message log tables with RLS.

## Operating notes

- A workspace owner or admin connects/disconnects the server and manages channel authorization.
- Managers and employees may send manual posts when an owner/admin has enabled a channel.
- Disconnecting stops Trading Docks sends but does not attempt to remove the bot from Discord or delete historical logs.
- V1 is manual-only. It does not schedule posts, auto-post inventory updates, add slash commands, or manage Discord roles.
