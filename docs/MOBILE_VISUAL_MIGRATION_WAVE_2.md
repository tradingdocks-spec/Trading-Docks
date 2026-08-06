# Mobile Visual Migration Wave 2

Status: Implemented as the Wave 2 migration specification for remaining customer-facing mobile surfaces.

## Scope

Wave 2 covers Trade Binder, Wishlist, Scanner Session Review, Deal Desk follow-up, Seller/Signals follow-up, Profile, Authentication, Welcome, Onboarding, and Plans. Admin and development-only screens remain deferred.

The migration is visual and structural only. It must preserve authentication, OCR, scanner recognition, billing, memberships, Supabase schemas, route authority, native module registration, offline queues, mutation contracts, and existing data ownership rules.

## Shared Acceptance Rules

- Implemented: Each Wave 2 screen has one hero, one dominant primary action, and progressive disclosure for secondary actions.
- Implemented: Customer-facing copy avoids technical implementation language.
- Implemented: Missing prices, unavailable metrics, and pending provider configuration are labeled honestly rather than rendered as zero or fake data.
- Implemented: Shared TD primitives are preferred over local button, row, segmented, card, and status variants.
- Partially Implemented: Physical-device VoiceOver, TalkBack, camera, and large-text QA remain manual release gates.

## Trade Binder

- Hero: Exchange workspace summary with binder count, total quantity, match count, and value only when real data exists.
- Primary action: Review Matches when matches exist; otherwise Add Cards via Collection.
- Supporting information: Compact Binder/Matches/Status segmentation, search, status filters, sort, quantity, condition, finish, location, and match state.
- Deferred information: Notes and full status-changing controls sit below identity and match context.
- Reusable components: `TDNavigationHeader`, `TDMetric`, `TDInput`, `TDSegmentedControl`, `TDListRow`, `TDBadge`, `TDButton`, `TDEmptyState`, `TDErrorState`, `TDLoadingState`, `TDStatusIndicator`.
- States: Empty binder, no matches, filtered no results, pending sync, mutation error, stale/offline.
- Mobile hierarchy: Card identity and trade status precede metadata; filters remain compact and non-dominant.
- Responsive behavior: Five-column metadata is avoided; rows wrap without horizontal scrolling at 320 px.
- Accessibility: Status is text-plus-badge; rows expose useful labels; segmented options expose selected state.
- Acceptance criteria: Exact versus flexible match copy is visible where matches are reviewed, no duplicated metadata, no fake values.

## Wishlist

- Hero: Wanted-card summary with target count, matched count, exact match count, and a restrained Add Wanted Card action.
- Primary action: Add Wanted Card.
- Supporting information: Priority, exact/flexible target description, ownership match state, quantity, status, and notes when supported.
- Deferred information: Set code and priority details are kept compact inside the add surface.
- Reusable components: `TDNavigationHeader`, `TDMetric`, `TDInput`, `TDSegmentedControl`, `TDListRow`, `TDBadge`, `TDButton`, `TDEmptyState`, `TDErrorState`, `TDLoadingState`.
- States: Empty wishlist, no matches, no filtered results, mutation error, pending sync, offline/stale.
- Mobile hierarchy: Desired card name and match state come before priority controls.
- Responsive behavior: Long card names and set text wrap inside rows.
- Accessibility: Priority is labeled in text and not color-only; remove actions are clear and separated.
- Acceptance criteria: Exact/flexible target copy remains accurate, matches are reviewable, and add/remove behavior is unchanged.

## Scanner Session Review

- Hero: Four concise metrics for cards, needs review, no price, and offer total.
- Primary action: Finalize reviewed cards only when no cards remain in Needs review.
- Supporting information: Compact status segmentation, optional active-filter summary, collapsed rows, Review next, and sticky session actions.
- Deferred information: Game filters, confidence filters, missing-price-only, sort order, quantity, price, cash percentage, review state, and remove live in sheets.
- Reusable components: `TDMetric`, `TDSegmentedControl`, `TDSheet`, `TDInput`, `TDBadge`, `TDButton`, `TDEmptyState`, `TDErrorState`, `TDLoadingState`.
- States: No active session, loading, unavailable, filtered empty, missing price.
- Mobile hierarchy: Totals and review state precede filter sheets and card-review editing.
- Responsive behavior: Bottom actions respect safe area and do not overlap tab navigation.
- Accessibility: Missing price is announced as unavailable, destructive remove remains explicit, filter selected states are exposed.
- Acceptance criteria: Missing price is never substituted as zero and CSV/export remains explicit.

## Deal Desk Follow-Up

- Hero: Current transaction offer with market total, cash offer, margin availability, and review availability.
- Primary action: Start, review, finalize, or export based on actual state.
- Supporting information: Session type, active session, market value, cash rate, budget, and honest unavailable metrics.
- Deferred information: Mode descriptions remain concise and secondary.
- Reusable components: `TDNavigationHeader`, `TDMetric`, `TDSegmentedControl`, `TDListRow`, `TDBadge`, `TDButton`, `TDErrorState`, `TDLoadingState`, `TDStatusIndicator`.
- States: Loading, error, no active session, active/paused session, missing market value.
- Mobile hierarchy: Transaction calculation is first; shortcuts and details are lower priority.
- Responsive behavior: No dashboard-style metric grid or horizontal overflow.
- Accessibility: Inputs are labeled, active state is text-based, and buttons expose disabled/loading states.
- Acceptance criteria: Only real session state is shown and seller/store workflow is preserved.

## Seller / Signals Follow-Up

- Hero: Account-aware work summary with active session when real data exists.
- Primary action: Open Deal Desk for seller/store users or Scan Cards for collector/free users.
- Supporting information: Signals/activity shortcuts and unavailable metrics.
- Deferred information: Marketplace, order, margin, and analytics modules stay planned until real data exists.
- Reusable components: `TDNavigationHeader`, `TDMetric`, `TDListRow`, `TDBadge`, `TDEmptyState`.
- States: Quiet workspace, active session, unavailable metrics, loading/empty/error where data sources exist.
- Mobile hierarchy: One hero, then concise next-action rows.
- Responsive behavior: No repeated boxed sections or duplicate navigation.
- Accessibility: Rows have labels and icons are decorative support, not sole meaning.
- Acceptance criteria: No unsupported metrics and account-aware access remains unchanged.

## Profile

- Hero: Signed-in identity, account type, membership visibility, and session status.
- Primary action: Manage Membership or Sign In depending on session state.
- Supporting information: Account, membership, security, preferences, scanner, notifications, business/admin, support, and sign-out groups.
- Deferred information: Version and setup details are low-emphasis.
- Reusable components: `TDNavigationHeader`, `TDListRow`, `TDMetric`, `TDBadge`, `TDButton`, `TDStatusIndicator`.
- States: Signed in, preview mode, active session, setup required.
- Mobile hierarchy: Identity first, grouped rows next, sign out separated.
- Responsive behavior: Email and workspace names wrap without clipping.
- Accessibility: Admin access remains additive; sign out is reachable but not visually dominant.
- Acceptance criteria: Membership is visible, security status is honest, and destructive/session actions remain clear.

## Authentication

- Hero: Sign-in or sign-up form with concise brand trust cues.
- Primary action: Sign In or Create Account.
- Supporting information: Provider buttons, remembered email, keep signed in, biometrics, magic link, recovery, and preview mode.
- Deferred information: Technical configuration failures appear only when required for setup.
- Reusable components: `TDNavigationHeader`, `TDInput`, `TDButton`, `TDErrorState`, `TDStatusIndicator`, `TDBadge`.
- States: Loading preferences, submitting, auth error, notice, magic link sent, provider unavailable.
- Mobile hierarchy: Primary email/password path is clear; social and magic link do not duplicate it.
- Responsive behavior: Keyboard-safe, narrow-width-safe, large-text-friendly.
- Accessibility: Password visibility has a label, checkboxes expose state, Enter submits, and errors are visible.
- Acceptance criteria: Auth behavior and exact Supabase error display remain unchanged.

## Welcome

- Hero: Trading Docks brand statement.
- Primary action: Get Started.
- Supporting information: Sign In and preview route.
- Deferred information: Plan names only; long feature lists are avoided.
- Reusable components: `TDButton`, `TDBadge`, `TDStatusIndicator`, `TDText`.
- States: Fast static load with safe-area support.
- Mobile hierarchy: Brand first, two CTAs second, supporting trust cue third.
- Responsive behavior: No fake chart, no fake metrics, no horizontal scroll.
- Accessibility: CTAs have clear labels and focus order follows visual order.
- Acceptance criteria: First impression feels premium without invented data.

## Onboarding

- Hero: Current setup step and progress.
- Primary action: Continue with selected account type.
- Supporting information: Account type descriptions and honest membership implications.
- Deferred information: Full plan details remain in Plans.
- Reusable components: `TDNavigationHeader`, `TDListRow`, `TDBadge`, `TDButton`, `TDStatusIndicator`.
- States: Account type selected, skip/back, completion route.
- Mobile hierarchy: One decision per screen; plan cards are quiet rows.
- Responsive behavior: Long plan copy wraps without horizontal overflow.
- Accessibility: Selected account type is exposed and back/skip controls are labeled.
- Acceptance criteria: Account type selection remains unchanged and does not overpromise features.

## Plans / Membership Selection

- Hero: Current plan and billing cycle.
- Primary action: Continue with selected plan.
- Supporting information: Free, Collector, Seller, and Store prices, annual savings, feature highlights, current plan state.
- Deferred information: Full feature lists expand per plan.
- Reusable components: `TDNavigationHeader`, `TDMetric`, `TDSegmentedControl`, `TDListRow`, `TDBadge`, `TDButton`.
- States: Current plan, expanded plan, provider pending configuration, free plan.
- Mobile hierarchy: Selected/current plan is clear; comparison uses stacked rows, not a table.
- Responsive behavior: No horizontal table or scroll; long feature copy wraps.
- Accessibility: Current plan is announced, billing cycle exposes selected state, and CTAs are explicit.
- Acceptance criteria: Canonical plan copy and pricing remain accurate; no unsupported employee-seat count is introduced.

## Wave 3 Candidates

- Planned: Admin/Command Center mobile polish.
- Planned: Settings deeper polish.
- Planned: Scanner Recovery visual follow-up.
- Planned: Dev-only design-system showcase refinements.
