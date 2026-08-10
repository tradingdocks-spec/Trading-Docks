# Mobile RC Final QA

Status: Release-candidate checklist for the active Expo mobile app.

## Scope

This checklist covers release-grade mobile behavior only. It does not change scanner OCR, exact-printing logic, RevenueCat identifiers, Supabase schemas, Stripe behavior, native dependencies, or Apple bundle identifiers.

## Release UX Contracts

- Loading states use skeletons or shared loading copy and must not show fake numbers.
- Empty states explain the state and offer one useful next action.
- Error states must be human-facing, avoid provider internals, and include a recovery action.
- Offline scanner work says: "Saved on this device" and "Will sync when you're back online."
- Motion is restrained: page 220ms, sheet 180ms, control 120ms, success 260ms, and 0ms with Reduce Motion.
- Haptics are limited to intentional actions, scanner success, purchase/restore success, and destructive confirmation.
- Production must not expose dev camera QA, benchmark tools, or design-system showcase routes without explicit development flags.

## Physical QA Checklist

### Auth

- Cold launch opens without status-bar or safe-area collisions.
- Sign in with password.
- Sign out from Profile.
- Relaunch restores the saved session.
- Expired-session state asks the user to sign in again.
- Network failure shows recoverable copy.
- Passwords are never persisted locally.

### Home

- Collection totals load without fake values.
- Recent additions show real card images or a missing-image state.
- Empty collection shows a clear first action.
- Bottom navigation never covers scroll content.
- Check widths: 320, 375, 390, 430.

### Collection

- Search by name, set, collector number, and storage location.
- Sort options: Recent, Name, Qty, Set, Price.
- List and grid views remain readable on 320px width.
- Card detail opens from list and grid.
- Empty, no-results, stale/offline, and retry states render cleanly.
- Card images keep card aspect ratio and never stretch.

### Scanner

- Trading Docks Scanner opens and stays responsive.
- Auto Scan OFF manual shutter remains available.
- Auto Scan ON uses the same still-capture recognition path and does not repeatedly capture the same stationary card.
- Tap focus reticle appears and clears.
- Lens selector changes lenses without stale-frame capture.
- Torch toggles without repeated state churn.
- Readiness copy is short and not color-only.
- Exact printing remains selectable.
- Finish switch shows only supported finishes.
- Other printings remains available.
- Repeat scan requires card removal before rearm.

### Review

- Review List restores saved scanner session.
- Correction sheet updates fields without layout clipping.
- Save/finalize flow handles queued, synced, and failed states.
- Empty review says no cards need review.

### Membership

- Plans screen shows current backend-authoritative plan.
- Collector, Seller, and Store selectors work.
- Monthly and Yearly selectors show StoreKit localized prices only.
- Sandbox purchase shows backend-sync pending state.
- Purchase cancellation is quiet.
- Restore with active Apple subscription shows account-updating copy.
- Empty restore does not fabricate paid access.
- Upgrade and downgrade copy is clear; StoreKit handles subscription changes.
- Stripe-paid Seller/Store users are not prompted as downgraded.
- Terms, Privacy, and Restore Purchases are accessible.

### Sync

- Offline scanner add is saved locally.
- Reconnect triggers replay.
- Failed replay remains visible.
- User switching never exposes another user's queue.
- Web/mobile membership parity remains backend-authoritative.

### Account

- Profile shows Manage Membership and current plan.
- Settings legal links open.
- Support link opens.
- Delete Account route explains consequences.
- Sign out clears active session UI.

### Device

- Small iPhone width: 320.
- Common iPhone width: 375 and 390.
- Current large iPhone width: 430.
- Low light scanner guidance remains readable.
- Cellular connection failure has retry copy.
- Wi-Fi reconnect resumes sync.

## Remaining TestFlight Blockers

- Complete physical sandbox purchase and restore on a signed iOS build.
- Verify RevenueCat webhook reconciliation updates canonical backend membership after App Store purchase.
- Verify dev routes are inaccessible in production runtime flags.
- Verify OCR native module availability on the installed iOS build.
- Verify camera lens behavior on the target iPhone model in low light.
