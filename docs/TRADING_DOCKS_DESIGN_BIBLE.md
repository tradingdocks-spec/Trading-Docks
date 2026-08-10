# Trading Docks Design Bible

Status: Implemented as the mobile product-design authority for Trading Docks OS.

## Product Philosophy

Trading Docks is the calm operating system for serious TCG work. It should feel precise, trustworthy, premium, operational, modern, and collectible-aware. It should not feel childish, noisy, sterile, or like desktop software compressed into a phone.

The product earns trust by showing real data clearly, admitting unavailable data honestly, and keeping important actions fast.

## Brand Character

- Calm: no decorative urgency, no shouting.
- Intelligent: surfaces explain status without exposing implementation detail.
- Precise: exact printing, condition, finish, quantity, storage, and offer data stay distinct.
- Trustworthy: no invented prices, charts, activity, or recognition certainty.
- Premium: restrained surfaces, crisp alignment, consistent spacing.
- Operational: scanning, buying, organizing, and reviewing feel fast.
- Modern: mobile-native navigation, sheets, haptics, and progressive disclosure.
- Collectible-aware: card images, printings, locations, and trade context remain visually important.

## Screen Hierarchy

Every screen must define:

1. Hero: the primary object or decision on the screen.
2. Primary action: the single most likely next step.
3. Supporting information: context that clarifies the hero.
4. Tertiary actions: useful but visually quiet.
5. Hidden or deferred information: advanced controls, diagnostics, raw IDs, and technical details.

Rules:

- Use one obvious hero per screen.
- Use one dominant primary action per screen.
- Use sheets or secondary rows for advanced controls.
- Do not show all possible actions at equal weight.
- Do not display technical copy in customer-facing states.

## Surface System

Use three surface levels maximum:

- Base: app background and normal page bands.
- Elevated: key hero, result tray, active session, or selected row.
- Modal/sheet: focused tasks, correction tools, settings, diagnostics, and confirmation.

Rules:

- Avoid nesting cards inside cards.
- Prefer spacing, alignment, dividers, and typography before adding borders.
- Use repeated cards only for repeated items.
- Do not wrap every section in a bordered panel.
- Use translucent/glass surfaces only when content sits over camera or modal context.

## Spacing System

Trading Docks uses a 4-point scale:

| Token | Value | Use |
| --- | ---: | --- |
| `half` | 4 | Fine internal gaps |
| `xs` | 8 | Dense rows, badges |
| `sm` | 12 | Row gaps, compact padding |
| `md` | 16 | Default card padding |
| `lg` | 24 | Screen gutters and hero padding |
| `xl` | 32 | Major section separation |
| `xxl` | 48 | Large layout separation |

Screen rules:

- Mobile gutters: 20-24 px.
- Section spacing: 16-24 px.
- Dense row height: minimum 48 px.
- Standard row height: 56-64 px.
- Card padding: 16 px, 24 px only for heroes.
- Sheet padding: 16-24 px.
- Bottom navigation clearance: use centralized safe-area inset rules, not ad hoc small padding.
- Scanner exception: the active Scan route may hide the normal bottom navigation so the camera can fill the screen. The account-aware tab bar must restore immediately when leaving scanner mode.
- Batch scanner exception: the active Scan route is a capture surface, not a decision form. It may show a tiny latest-scan confirmation and Review List chip, but pricing, quantity, condition, finish, confidence explanation, and final decisions belong in Scanner Session Review.

## Typography

| Role | Use |
| --- | --- |
| Display | Rare hero statements only |
| Screen title | Primary screen identity |
| Section title | Short section headers |
| Body | Default explanatory text |
| Metadata | Secondary data and timestamps |
| Label | Small uppercase labels |
| Value | Important numbers and offer values |
| Badge | Short status only |
| Button | Action labels |

Rules:

- Do not use display type inside compact panels.
- Avoid more than three visible type levels on one screen.
- Labels can use uppercase; paragraphs should not.
- Letter spacing must remain neutral except compact labels.
- Long names must wrap gracefully without creating one-word columns.

## Color System

| Role | Color Direction |
| --- | --- |
| Background | Dark navy |
| Elevated background | Slightly lighter navy |
| Glass surface | Translucent deep navy over camera/modal context |
| Primary action | Electric blue |
| Secondary action | Elevated navy with blue text/icon |
| Informational | Cyan |
| Success | Emerald |
| Warning | Amber |
| Critical | Red |
| Accent | Restrained purple |
| Text primary | Near-white |
| Text secondary | Cool slate |
| Disabled | Muted slate and lower opacity |
| Dividers | Subtle slate/navy |

Rules:

- Do not communicate status by color alone.
- Avoid glow as a default state.
- Use purple sparingly for specialty or membership accents.
- Missing values use an em dash or `Unavailable`, depending on space and context.
- Scanner states use cyan/blue for guidance, emerald for ready/success, amber for review, red for hard failure.

## Motion And Haptics

Motion should make state changes legible, never decorative.

Duration scale:

- Tap: 120 ms.
- Fast: 180 ms.
- Standard: 260 ms.
- Slow: 420 ms.

Allowed motion:

- Press feedback.
- Sheet entrance/exit.
- Result tray entrance.
- Tab selection feedback.
- Scanner capture flash.
- Scanner success/review feedback.
- List insertion when it clarifies a new item.

Haptic rules:

- Capture: selection haptic.
- Success: success notification haptic.
- Review required: light notification haptic.
- Destructive confirmation: warning haptic.

Reduced motion disables decorative pulse/flash but keeps visible status changes.

## Iconography

Use Ionicons as the single mobile icon family.

Sizes:

- 16: metadata or badge icons.
- 20: default inline/action icon.
- 24: primary action icon.
- 28: scanner capture or hero-support icon.

Rules:

- Navigation icons use 22 px optical size today and should remain visually balanced.
- Filled icons are active/selected states.
- Outline icons are inactive/default states.
- Icon-only actions require accessible labels.
- Do not use ambiguous placeholder circles.

## Button System

Button roles:

- Primary: one dominant action per screen.
- Secondary: common supporting action.
- Tertiary/ghost: navigation, correction, or low-emphasis action.
- Destructive: destructive confirmation only.
- Icon: compact navigation or utility action.
- Scanner capture: specialized primary action inside camera control row.

Rules:

- Do not render five or six equally weighted actions.
- Use icons when they clarify the action.
- Loading and disabled states must be visible and accessible.
- Button labels should be short and concrete.

## Empty, Loading, Error, And Success

Empty states:

- State what is empty.
- Explain the next real action.
- Do not use generic placeholder language.

Loading states:

- Use skeletons for content layout where practical.
- Use spinner states for short blocking operations.
- Avoid long operational copy.

Errors:

- Use customer-facing recovery text.
- Preserve exact backend errors only in auth where required.
- Keep technical diagnostics out of normal user screens.

Success:

- Confirm the action briefly.
- Keep the user in flow.
- Avoid modal interruption unless the action is destructive or irreversible.

## Screen-Specific Hero Rules

- Scanner: camera viewport is the hero and should not be placed inside a page-style card while active scanning is underway.
- Home: current account/work summary is the hero. The active mobile route follows `docs/HOME_PRODUCT_V2.md`: compact account header, one hero, at most four quick actions, real Recent Adds, and one insight.
- Collection: search and inventory result quality are the hero.
- Card Detail: card image is the hero.
- Storage: location path and "where is this card" flow are the hero.
- Trade Binder/Wishlist: exchange match clarity is the hero.
- Session Review: current deal/intake totals are the hero.
- Session Review: default view should answer cards, attention, offer, next review, and finalize. Advanced filters and card edits belong in sheets, not collapsed rows.
- Deal Desk: current transaction offer is the hero.
- Profile: signed-in identity and account status are the hero.
- Auth: sign-in form and trust cues are the hero.

## Non-Negotiables

- No fake metrics.
- No fake charts.
- No invented prices.
- No invented scanner confidence.
- No retained/uploaded card images by default.
- No desktop tables squeezed into mobile.
- No nested cards.
- No technical copy in customer-facing states.
- No more than one dominant primary action per screen.

## Mobile Migration Status

- Implemented: Mobile Design OS Waves 1, 2, and 3 have migrated the active customer-facing mobile routes, Command Center summary, Settings, Scanner Recovery, and the gated dev showcase toward this hierarchy.
- Implemented: Mobile Home now uses the Home Product V2 card-first hierarchy and no longer uses a dense list-row dashboard pattern.
- Partially Implemented: Dense admin management routes are intentionally deferred for a dedicated admin-mobile workflow pass.
- Requires Production Configuration: Physical-device VoiceOver, TalkBack, camera, OCR, and large-text release QA remain required before declaring release-complete mobile polish.
