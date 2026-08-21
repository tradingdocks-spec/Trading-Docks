# Trading Docks Premium Product Polish

Status labels:

- Fixed: improved in `codex/production-launch-hardening`.
- P1: must be verified or accepted before a public production launch.
- P2: acceptable for closed beta only with known-issue tracking.
- Follow-up: not a launch blocker unless reproduced as a user-facing defect.

## Current Polish Pass

- Branch: `codex/production-launch-hardening`
- Scope: source-level product-quality audit plus targeted low-risk polish for shared dashboard primitives, Orders, and Customer CRM.
- Non-goals: no pricing changes, entitlement changes, marketplace logic changes, deck-algorithm changes, Supabase schema changes, or broad product redesign.
- Screenshot status: existing public Playwright visual baselines remain the automated browser reference. Authenticated screenshots were not captured in this environment because representative QA credentials were not available.

## Product Surfaces Reviewed

| Surface | Review type | Result |
| --- | --- | --- |
| Public site and pricing | Existing Playwright/source coverage | Unified public design direction is already covered by public visual baselines and route smoke. |
| Auth pages | Existing Playwright/source coverage | Forms render and remain searchable; live provider/email behavior still needs deployed QA. |
| Dashboard shell | Source review and focused tests | Shared page header/action hierarchy and metric-card proportions were tightened. |
| Inventory/Collection | Source review | Active surface is large and dense; needs authenticated populated-account browser QA before production sign-off. |
| Orders | Source review and targeted polish | Hero, action hierarchy, table density, empty state, and checkbox/expand accessibility were improved. |
| Customer CRM | Source review and targeted polish | Detail panels, tiny labels, modal close, delete, and loyalty controls were improved. |
| Analytics | Source review | Data-populated visual pass still required because empty/source review cannot verify real chart density. |
| Deck Architect and Deck Vault | Existing tests/source review | Recommendation/detail surfaces need populated-deck browser and mobile-device legibility QA. |
| Admin/Owner tools | Source review | No broad changes; deployed Owner/Admin walkthrough remains required. |
| Mobile Expo app | Documentation-only in this pass | No mobile code changed; physical device QA remains required. |

## Fixed In This Pass

- Shared dashboard headers now align actions with page identity instead of pushing controls into a stretched lower edge on wide screens.
- Header primary actions now expose stable accessible names.
- Shared metric cards use a slightly calmer radius, tighter padding, normalized icon dimensions, and more readable dashboard captions.
- Orders now has a denser premium operating surface: reduced decorative glow, clearer primary/secondary action hierarchy, less bulky table chrome, and an empty state that describes the real integration state.
- Orders row selection and expansion controls now have explicit accessible labels.
- Customer CRM detail and configuration panels now use more legible caption sizing and clearer action labels without changing workflow behavior.
- CRM loyalty, delete, and modal-close controls now have stable accessible names.

## P1 Polish Inventory

| Area | Issue | Required proof |
| --- | --- | --- |
| Authenticated dashboard surfaces | Source review cannot prove visual quality with real Free/Collector/Seller/Store/Owner data. | Run authenticated Playwright/browser QA with representative accounts and capture screenshots for Dashboard, Inventory, Orders, CRM, Analytics, Admin, Label Studio, Deck Architect, and Deck Vault. |
| Inventory/Collection | The active Inventory workspace remains a very large component with dense route-local panels and table controls. | Browser QA with empty, small, and large collections; follow-up extraction only where it reduces real complexity. |
| Deck Architect | Recommendation-heavy views can become visually dense with real deck data. | Populated commander/deck browser QA at desktop, tablet, and mobile widths. |
| Deck Vault/detail | Card imagery, one-card sections, and text/list/card modes require real image and responsive proof. | Populated deck QA with slow image/loading/error conditions. |
| Analytics | Real chart/table composition cannot be validated from empty-state source review. | Populated Seller/Store/Owner analytics QA with real workspace-scoped data. |
| Mobile physical app | Scanner, safe-area navigation, keyboard behavior, and offline replay are device-dependent. | Current iOS/Android builds on real devices. |

## P2 Polish Inventory

| Area | Issue | Recommended cleanup |
| --- | --- | --- |
| Dashboard primitives | Older route-local card styles still coexist with newer Trading Docks primitives. | Continue migrating touched surfaces toward `PageScaffold`, `PageHeader`, `MetricCard`, and shared `td-*` utility classes. |
| Caption typography | Some legacy dashboard files still use 9-10px uppercase labels. | Raise dashboard captions toward the 0.68rem baseline unless the text is purely decorative metadata. |
| Border density | Some advanced tools still rely on nested bordered panels. | Prefer tonal separation and whitespace over card-in-card borders when touching those routes. |
| Large component files | Inventory and several business workspaces mix data, transformation, and presentation. | Extract only durable helpers/components with clear reuse or complexity reduction. |
| Legacy dashboard-v2 | Historical dashboard modules still create code-search noise. | Archive after import/reference audit; do not delete during launch hardening. |

## Active Polish Rules

- Use product-specific copy over template phrases.
- Keep one clear dominant action per surface; secondary and tertiary actions should not visually compete.
- Avoid giant floating cards, decorative glow, and gradients unless they carry real hierarchy.
- Avoid permanent forms when a modal/drawer action keeps the workspace calmer.
- Use `td-kicker`, `td-title`, `td-body`, `td-button-primary`, and `td-button-secondary` where they match the surface.
- Dashboard caption text should generally be at least `0.68rem` with restrained tracking.
- Icon-only or ambiguous controls must have accessible names.
- Collapsed, empty, failed, disconnected, and loading states must be textual, not color-only.

## GO / NO-GO For Polish

- Public unauthenticated polish: GO for current automated browser baseline coverage.
- Authenticated web polish: NO-GO until representative account screenshots and workflows are exercised.
- Mobile polish: NO-GO until physical iOS/Android QA is run.
- Closed beta posture: acceptable only if the P1 polish inventory above remains tracked and any reproduced blocking defects are fixed before invite expansion.
