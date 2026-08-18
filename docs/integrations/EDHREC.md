# EDHREC Integration Status

Status: Not integrated.

Trading Docks does not scrape EDHREC, call undocumented EDHREC JSON endpoints, crawl EDHREC pages, mirror EDHREC recommendations, or use EDHREC as a production backend.

## Desired Licensed Data

- Commander inclusion rates.
- Commander and archetype themes.
- Deck counts and adequate sample sizes.
- Commander-card synergy signals.
- Strategy and meta trend data.
- Theme-specific card stats.
- Budget variant stats.
- Data freshness and provenance metadata.

## Legal Boundary

EDHREC data would require explicit commercial permission or a licensed data/API agreement before it can be used in Trading Docks production features. The repository contains only an abstract Commander meta-provider boundary so a licensed implementation can be attached later without changing Deck Architect UI code.

Provider interface ready: yes.

Current provider behavior:

- `EdhrecLicensedMetaProvider` remains disabled.
- The provider returns no production card evidence without an approved licensed backend.
- Deck Architect does not scrape EDHREC, crawl pages, call undocumented endpoints, or mirror EDHREC recommendations.

## Provider Contract

A licensed commander-meta provider should supply:

- Commander profile evidence.
- Commander strategy/theme lists.
- Commander-card evidence.
- Strategy-card evidence.
- Inclusion rate, synergy, sample size, observed deck count, freshness, theme, archetype, and provenance fields where licensed data supports them.

## Next Step

Open a commercial licensing conversation with EDHREC before implementing any provider backed by EDHREC data.

Product leadership TODO:

- Contact EDHREC / Space Cow Media about commercial data or API access for a licensed commander/archetype evidence provider.
- Confirm permitted caching, attribution, retention, rate limits, and redistribution boundaries before implementation.
- Keep the Trading Docks Deck Corpus path independent so lawful first-party or owner-provided datasets can improve Deck Architect without relying on EDHREC.
