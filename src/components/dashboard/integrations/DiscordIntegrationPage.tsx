"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronRight, MessageCircle, RefreshCw, Send, ShieldCheck, Unplug } from "lucide-react";

type Integration = {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_icon_url: string | null;
  status: string;
  connected_at: string;
  disconnected_at: string | null;
} | null;

type Channel = {
  id: string;
  channel_id: string;
  channel_name: string;
  purpose: string | null;
  enabled: boolean;
  can_view: boolean;
  can_send: boolean;
  can_embed: boolean;
  unavailable_reason: string | null;
};

type Log = {
  id: string;
  channel_name: string | null;
  announcement_type: string;
  title: string;
  status: string;
  sent_at: string;
  error_summary: string | null;
};

type Showcase = { slug: string; display_name: string; enabled: boolean } | null;
type InventoryCard = { id: string; name: string; set: string | null; condition: string | null; price: number; quantity: number };
type AnnouncementType = "general" | "tournament" | "deal" | "new_arrival" | "restock" | "showcase" | "buylist" | "test";

const templates: Record<AnnouncementType, { title: string; body: string }> = {
  general: { title: "Store announcement", body: "We have an update from the shop.\n\nStop by or message us if you have questions." },
  tournament: { title: "Friday Night Modern", body: "Friday · 6:30 PM\nEntry: $10\n\nPrize support: Store credit\n\nCome play with us this Friday." },
  deal: { title: "This week's deal", body: "Selected singles are on sale this week.\n\nBrowse the current selection while supplies last." },
  new_arrival: { title: "New arrivals just landed", body: "Fresh inventory is now available.\n\nFeatured cards are listed below." },
  restock: { title: "Restock alert", body: "Popular cards are back in stock.\n\nBrowse the live selection before they move again." },
  showcase: { title: "Browse our live inventory", body: "Looking for something specific?\n\nSearch our available inventory here:" },
  buylist: { title: "We're buying cards", body: "Check our current buylist or contact the shop for details." },
  test: { title: "Trading Docks is connected", body: "This is a test message from your Trading Docks workspace." },
};

export function DiscordIntegrationPage({
  integration,
  channels: initialChannels,
  logs: initialLogs,
  showcase,
  canManage,
  canSend,
  queryError,
  connected = false,
}: {
  integration: Integration;
  channels: Channel[];
  logs: Log[];
  showcase: Showcase;
  canManage: boolean;
  canSend: boolean;
  queryError: string | null;
  connected?: boolean;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [logs, setLogs] = useState(initialLogs);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [type, setType] = useState<AnnouncementType>("general");
  const [title, setTitle] = useState(templates.general.title);
  const [body, setBody] = useState(templates.general.body);
  const [selectedChannel, setSelectedChannel] = useState(() => initialChannels.find((channel) => channel.enabled && channel.can_send)?.id ?? "");
  const [link, setLink] = useState("");
  const [inventory, setInventory] = useState<InventoryCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const enabledChannels = useMemo(() => channels.filter((channel) => channel.enabled && channel.can_send), [channels]);
  const siteOrigin = typeof window === "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL || "") : window.location.origin;
  const showcaseUrl = showcase?.enabled && siteOrigin
    ? `${siteOrigin.replace(/\/$/, "")}/s/${encodeURIComponent(showcase.slug)}?utm_source=discord&utm_medium=community`
    : "";
  const previewCards = inventory.filter((card) => selectedCards.includes(card.id));

  function chooseType(next: AnnouncementType) {
    setType(next);
    setTitle(templates[next].title);
    setBody(templates[next].body);
  }

  async function requestJson(path: string, options: RequestInit = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) } });
    const result = await response.json().catch(() => ({})) as { error?: string; channels?: Channel[]; channel?: Channel; cards?: InventoryCard[]; ok?: boolean };
    if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
    return result;
  }

  async function refreshChannels() {
    setBusy("channels"); setFeedback(null);
    try {
      const result = await requestJson("/api/integrations/discord/channels/discover", { method: "POST" });
      setChannels(result.channels ?? []);
      setFeedback("Discord channels refreshed.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Channels could not be refreshed."); }
    finally { setBusy(null); }
  }

  async function updateChannel(channel: Channel, patch: { enabled?: boolean; purpose?: string | null }) {
    setBusy(`channel-${channel.id}`); setFeedback(null);
    try {
      const result = await requestJson("/api/integrations/discord/channels", { method: "PATCH", body: JSON.stringify({ bindingId: channel.id, enabled: patch.enabled ?? channel.enabled, purpose: patch.purpose === undefined ? channel.purpose : patch.purpose }) });
      if (result.channel) setChannels((current) => current.map((item) => item.id === channel.id ? result.channel as Channel : item));
      setFeedback("Channel settings saved.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Channel settings could not be saved."); }
    finally { setBusy(null); }
  }

  async function loadInventory() {
    setBusy("inventory"); setFeedback(null);
    try {
      const result = await requestJson("/api/integrations/discord/inventory");
      setInventory(result.cards ?? []);
      setFeedback("Recent inventory loaded. Choose up to eight featured cards.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Inventory could not be loaded."); }
    finally { setBusy(null); }
  }

  async function sendMessage() {
    if (!selectedChannel) { setFeedback("Choose an authorized channel first."); return; }
    setBusy("send"); setFeedback(null);
    try {
      await requestJson("/api/integrations/discord/messages", { method: "POST", body: JSON.stringify({ bindingId: selectedChannel, type, title, body, link, featuredCards: previewCards }) });
      setFeedback("Message sent to Discord.");
      setLogs((current) => [{ id: `local-${Date.now()}`, channel_name: channels.find((channel) => channel.id === selectedChannel)?.channel_name ?? null, announcement_type: type, title, status: "sent", sent_at: new Date().toISOString(), error_summary: null }, ...current]);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Message could not be sent."); }
    finally { setBusy(null); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Discord from this workspace? Existing send history will remain available.")) return;
    setBusy("disconnect"); setFeedback(null);
    try { await requestJson("/api/integrations/discord/disconnect", { method: "POST" }); window.location.reload(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Discord could not be disconnected."); setBusy(null); }
  }

  const errorMessage = queryError ? ({ configuration_required: "Discord is not configured on this deployment yet. Add the server-side Discord Developer Portal values before connecting.", admin_required: "Only a workspace owner or admin can connect or manage Discord.", oauth_cancelled: "Discord authorization was cancelled.", oauth_state_invalid: "The Discord authorization expired or was already used. Start again.", oauth_exchange_failed: "Discord authorization could not be completed. Check the app configuration and try again.", integration_save_failed: "Discord authorized the app, but the workspace connection could not be saved.", state_unavailable: "A secure Discord authorization state could not be created." } as Record<string, string>)[queryError] ?? "Discord connection could not be completed." : null;

  return (
    <main className="dashboard-responsive mx-auto max-w-[1200px] px-4 py-7 sm:px-7 sm:py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-td-accent-text"><MessageCircle className="h-4 w-4" /> Integrations</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-td-primary">Connect your community</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">Send tournaments, new arrivals, deals, and Showcase updates directly into your Discord server.</p>
        </div>
        {integration?.status === "connected" ? <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.07] px-3 py-1.5 text-xs font-bold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Connected</span> : null}
      </div>
      {errorMessage || connected ? <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${connected ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100" : "border-amber-300/20 bg-amber-300/[.06] text-amber-100"}`} role="status">{connected ? "Discord is connected. Refresh channels to choose where Trading Docks may post." : errorMessage}</div> : null}
      {feedback ? <div className="mt-4 rounded-2xl border border-td-accent/20 bg-td-accent/[.06] px-4 py-3 text-sm text-td-secondary" role="status">{feedback}</div> : null}

      {!integration || integration.status !== "connected" ? (
        <section className="mt-8 rounded-[28px] border border-td-ink/[.08] bg-td-surface/70 p-6 shadow-[0_20px_80px_rgb(var(--td-shadow-rgb)/.12)] sm:p-9">
          <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2] text-2xl font-black text-white">D</div><h2 className="mt-5 text-2xl font-semibold text-td-primary">Discord</h2><p className="mt-2 text-sm leading-6 text-td-muted">Authorize the Trading Docks Discord application for your server. You choose the server and Trading Docks only posts to channels you explicitly authorize.</p><p className="mt-3 text-xs leading-5 text-td-muted">You can disconnect the integration at any time. No Discord password or bot token is requested from your store.</p></div>
            <div className="shrink-0">{canManage ? <a href="/api/integrations/discord/connect" className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-5 text-sm font-bold text-td-on-accent transition hover:bg-td-accent-hover"><MessageCircle className="h-4 w-4" /> Connect Discord</a> : <p className="max-w-xs text-sm text-td-muted">Ask a workspace owner or admin to connect Discord.</p>}</div>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-[28px] border border-td-ink/[.08] bg-td-surface/70 p-5 sm:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#5865F2] text-2xl font-black text-white">{integration.guild_icon_url ? <img src={integration.guild_icon_url} alt="" className="h-full w-full object-cover" /> : "D"}</div><div className="min-w-0"><h2 className="truncate text-xl font-semibold text-td-primary">{integration.guild_name}</h2><p className="mt-1 text-sm text-td-muted">Connected {new Date(integration.connected_at).toLocaleDateString()} · {enabledChannels.length} authorized channel{enabledChannels.length === 1 ? "" : "s"}</p></div></div>
              <div className="flex flex-wrap gap-2">{canManage ? <button type="button" onClick={() => void refreshChannels()} disabled={busy === "channels"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[.1] px-3 text-xs font-bold text-td-secondary hover:bg-td-ink/[.04] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy === "channels" ? "animate-spin" : ""}`} /> Refresh channels</button> : null}{canManage ? <button type="button" onClick={() => void disconnect()} disabled={busy === "disconnect"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-300/15 px-3 text-xs font-bold text-rose-200 hover:bg-rose-300/[.05] disabled:opacity-50"><Unplug className="h-3.5 w-3.5" /> Disconnect</button> : null}</div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
            <section className="rounded-[24px] border border-td-ink/[.08] bg-td-surface/60 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-td-primary">Authorized channels</h2><p className="mt-1 text-xs leading-5 text-td-muted">Only enabled channels can receive Trading Docks posts.</p></div><ShieldCheck className="h-5 w-5 text-td-accent-text" /></div><div className="mt-5 space-y-2">{channels.length ? channels.map((channel) => <div key={channel.id} className="rounded-2xl border border-td-ink/[.07] bg-td-ink/[.02] p-3"><div className="flex items-start gap-3"><label className="flex min-w-0 flex-1 items-start gap-3"><input type="checkbox" checked={channel.enabled} disabled={!canManage || !channel.can_view || !channel.can_send || busy === `channel-${channel.id}`} onChange={(event) => void updateChannel(channel, { enabled: event.target.checked })} className="mt-1 h-4 w-4 accent-cyan-300" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-td-primary"># {channel.channel_name}</span><span className={`mt-1 block text-xs ${channel.can_view && channel.can_send ? "text-emerald-300" : "text-amber-200"}`}>{channel.unavailable_reason ?? (channel.can_embed ? "Ready for posts and embeds" : "Ready for text posts")}</span></span></label><select aria-label={`Purpose for ${channel.channel_name}`} value={channel.purpose ?? ""} disabled={!canManage || busy === `channel-${channel.id}`} onChange={(event) => void updateChannel(channel, { purpose: event.target.value || null })} className="max-w-[130px] rounded-lg border border-td-ink/[.1] bg-td-surface px-2 py-2 text-xs text-td-secondary"><option value="">No purpose</option><option value="general">General</option><option value="deals">Deals</option><option value="new_arrivals">New arrivals</option><option value="tournaments">Tournaments</option><option value="events">Events</option><option value="buylist">Buylist</option><option value="showcase">Showcase</option><option value="other">Other</option></select></div></div>) : <div className="rounded-2xl border border-dashed border-td-ink/[.1] p-6 text-center text-sm text-td-muted">No channels discovered yet. Refresh channels after installing the bot.</div>}</div></section>

            <section className="rounded-[24px] border border-td-ink/[.08] bg-td-surface/60 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-td-primary">Create an announcement</h2><p className="mt-1 text-xs leading-5 text-td-muted">Preview your post, then send it manually when you are ready.</p></div><Send className="h-5 w-5 text-td-accent-text" /></div>{canSend ? <div className="mt-5 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Announcement type"><select value={type} onChange={(event) => chooseType(event.target.value as AnnouncementType)} className="control"><option value="general">General announcement</option><option value="tournament">Tournament / event</option><option value="deal">Deal / promotion</option><option value="new_arrival">New arrivals</option><option value="restock">Restock</option><option value="showcase">Showcase inventory</option><option value="buylist">Buylist</option><option value="test">Connection test</option></select></Field><Field label="Authorized channel"><select value={selectedChannel} onChange={(event) => setSelectedChannel(event.target.value)} className="control"><option value="">Choose a channel</option>{enabledChannels.map((channel) => <option key={channel.id} value={channel.id}># {channel.channel_name}</option>)}</select></Field></div><Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} className="control" maxLength={160} /></Field><Field label="Message"><textarea value={body} onChange={(event) => setBody(event.target.value)} className="control min-h-32 resize-y" maxLength={4000} /></Field><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setLink(showcaseUrl)} disabled={!showcaseUrl} className="inline-flex h-9 items-center gap-2 rounded-lg border border-td-accent/20 px-3 text-xs font-bold text-td-accent-text disabled:cursor-not-allowed disabled:opacity-40">Insert Showcase link</button>{type === "new_arrival" ? <button type="button" onClick={() => void loadInventory()} disabled={busy === "inventory"} className="inline-flex h-9 items-center gap-2 rounded-lg border border-td-ink/[.1] px-3 text-xs font-bold text-td-secondary disabled:opacity-50">{busy === "inventory" ? "Loading…" : "Choose recent inventory"}</button> : null}</div>{inventory.length ? <div className="rounded-xl border border-td-ink/[.08] p-3"><p className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-td-muted">Featured cards</p><div className="grid gap-1 sm:grid-cols-2">{inventory.map((card) => <label key={card.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-td-secondary hover:bg-td-ink/[.03]"><input type="checkbox" checked={selectedCards.includes(card.id)} disabled={!selectedCards.includes(card.id) && selectedCards.length >= 8} onChange={(event) => setSelectedCards((current) => event.target.checked ? [...current, card.id].slice(0, 8) : current.filter((id) => id !== card.id))} className="h-3.5 w-3.5 accent-cyan-300" /><span className="min-w-0 truncate">{card.name}<small className="ml-1 text-td-muted">{card.set ?? ""}</small></span></label>)}</div></div> : null}<div className="rounded-2xl border border-[#5865F2]/30 bg-[#5865F2]/[.07] p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#b8b9ff]">Discord preview</p><p className="mt-2 text-sm font-bold text-white">{title || "Your announcement title"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{body || "Your message will appear here."}</p>{previewCards.length ? <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{previewCards.map((card) => `• ${card.name}${card.price ? ` — $${card.price.toFixed(2)}` : ""}`).join("\n")}</p> : null}{link ? <p className="mt-3 break-all text-xs text-[#b8b9ff]">{link}</p> : null}{showcaseUrl && (type === "showcase" || type === "new_arrival" || type === "restock") ? <p className="mt-3 break-all text-xs text-[#b8b9ff]">{showcaseUrl}</p> : null}</div><button type="button" onClick={() => void sendMessage()} disabled={busy === "send" || !enabledChannels.length} className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /> {busy === "send" ? "Sending…" : "Send to Discord"}</button></div> : <p className="mt-6 rounded-xl border border-td-ink/[.08] p-4 text-sm text-td-muted">Your workspace role can view the integration, but sending is limited to approved staff roles.</p>}</section>
          </div>

          <section className="mt-6 rounded-[24px] border border-td-ink/[.08] bg-td-surface/60 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-td-primary">Recent activity</h2><p className="mt-1 text-xs text-td-muted">A safe, workspace-scoped record of posts sent through Trading Docks.</p></div><Link href="/dashboard/showcase" className="inline-flex items-center gap-1 text-xs font-bold text-td-accent-text hover:text-td-accent-hover">Open Showcase <ChevronRight className="h-3.5 w-3.5" /></Link></div><div className="mt-5 divide-y divide-td-ink/[.07]">{logs.length ? logs.map((log) => <div key={log.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-td-primary">{log.title}</p><p className="mt-1 text-xs text-td-muted">{log.channel_name ? `#${log.channel_name}` : "Discord"} · {new Date(log.sent_at).toLocaleString()}</p></div><span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${log.status === "sent" ? "bg-emerald-400/[.08] text-emerald-300" : "bg-rose-400/[.08] text-rose-200"}`}>{log.status === "sent" ? <Check className="h-3 w-3" /> : null}{log.status === "sent" ? "Sent" : log.error_summary ?? "Failed"}</span></div>) : <p className="py-6 text-sm text-td-muted">No Discord messages have been sent yet.</p>}</div></section>
        </>
      )}
      <style jsx>{`.control{width:100%;border-radius:.75rem;border:1px solid rgb(var(--td-ink-rgb)/.1);background:var(--td-surface);padding:.65rem .75rem;font-size:.875rem;color:var(--td-text-primary);outline:none}.control:focus{border-color:rgb(var(--td-accent-rgb)/.5);box-shadow:0 0 0 3px rgb(var(--td-accent-rgb)/.12)}.control::placeholder{color:var(--td-text-muted)}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-bold uppercase tracking-[.12em] text-td-muted">{label}<span className="mt-2 block normal-case tracking-normal">{children}</span></label>;
}
