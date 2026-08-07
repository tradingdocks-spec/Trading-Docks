# Mobile Release QA

Status: Implemented as the mobile release QA checklist for the Design OS migration.

## Required Device Matrix

- 320 px width.
- 375 px width.
- 390 px width.
- 430 px width.
- Small iPhone height.
- Large iPhone height.
- Common Android phone.
- Narrow Expo Web.
- Large accessibility text.
- Reduced motion.
- VoiceOver on iOS.
- TalkBack on Android.
- Existing OCR-capable development build for native scanner QA.

## Route Coverage

Verify:

- Welcome, Onboarding, Auth, Plans.
- Home Product V2, Collection, Card Detail, Storage Locations.
- Scanner, Scanner Session Review, Scanner Recovery.
- Trade Binder and Wishlist.
- Deal Desk and Seller/Signals.
- Profile and Settings.
- Admin Command Center summary and access denial.
- Dev-only Design System route with flag enabled and disabled.
- Dev-only Camera QA and Scanner Benchmark Builder routes with flags enabled and disabled.
- Legacy `/experience` route redirect and `/modal` fallback.

## State Coverage

Verify each route where supported:

- Loading.
- Empty.
- Error.
- Offline.
- Stale.
- Pending sync.
- Long card name.
- Long workspace name.
- Long email.
- Long plan name.
- Long location path.

## Accessibility Checklist

- Icon-only buttons have labels.
- Rows and tabs expose selected state where applicable.
- Switches expose checked state.
- Loading controls expose busy/disabled state.
- Errors are visible and recoverable.
- Destructive actions are visually separated and require confirmation when destructive.
- Status is never color-only.
- Primary action remains visible at larger text sizes.
- Bottom navigation does not cover content.
- Scanner guidance has a text equivalent.
- Scan route hides bottom navigation only while active and restores it after Back/Profile/Home navigation.

## Scanner QA

Verify:

- Camera mode Auto, Close-up, Standard, and Telephoto availability on the target device.
- Camera mode changes update the development Camera QA device name, physical device types, selected format, focus distance, neutral zoom, preview resolution, capture resolution, and switch duration.
- Duplicate fixed camera modes are hidden when VisionCamera maps them to the same physical rear camera.
- Switching camera modes blocks auto-capture, clears stale frame analysis, preserves the session, and rearms after readiness returns.
- Camera permission denied.
- Camera unavailable.
- Poor lighting.
- Network failure after OCR title exists.
- No-title OCR.
- No-match result.
- Retake.
- Manual Search.
- Stale result cancellation.
- Duplicate stationary card prevention.
- Explicit pause and resume.
- Full-screen camera fill with no inset card frame or empty tab gap.
- Torch and Capture hide during capture, lookup, saving, open sheets, added feedback, and remove-card lockout. Manual Search remains available from settings and recovery states.
- High-confidence scan adds to Review List without an Add button.
- Likely and ambiguous scans add as Needs review without stopping the scanner.
- Failed scan shows Retake/Search and does not add an unknown row.
- Manual Search selection adds to Review List and returns to camera.
- Review List chip updates scanned and review counts.
- Undo removes the most recent transient batch add.
- Correct opens Scanner Session Review.
- Remove-card lockout prevents the same stationary card from being scanned twice.
- Scryfall pricing enriches Review List rows only after insertion when a positive exact-printing price is available; scanner must not block on price.
- Recognized result does not show a primary confidence percentage.
- Failed result shows only compact Retake/Search recovery.
- Added/remove-card feedback remains brief and does not become a full result card.
- Session preservation after app background/foreground.
- Failed queued scan retry.
- Failed queued scan discard confirmation.

## Scanner Session Review QA

Verify:

- Four primary metrics maximum: Cards, Needs review, No price, Offer total.
- Game, confidence, missing-price, and sort controls open from the filter sheet.
- Collapsed card rows have no inline text inputs or destructive buttons.
- Card review sheet preserves quantity, market price, cash percentage, and offer math.
- Review next advances only after Mark reviewed.
- Finalize is disabled while cards remain in Needs review.
- Missing prices render as an em dash and are excluded from totals.
- Sticky actions do not cover the final card at 320, 375, 390, and 430 px widths.

## Release Exit Criteria

- Root TypeScript passes.
- Mobile TypeScript passes.
- Focused mobile lint passes for changed files.
- Full mobile tests pass.
- Expo Web export passes.
- Expo config prebuild passes.
- `expo install --check` passes.
- Apple OCR autolinking search and Apple resolve include `trading-docks-vision-ocr` and `TradingDocksVisionOcrModule`.
- `git diff --check` passes.
- Manual physical-device QA is complete or explicitly deferred by product owner.
- `docs/MOBILE_RELEASE_CANDIDATE_AUDIT.md`, `docs/MOBILE_BILLING_RELEASE_ARCHITECTURE.md`, `docs/MOBILE_PRIVACY_RELEASE_AUDIT.md`, and `docs/MOBILE_STORE_RELEASE_CHECKLIST.md` are reviewed by product owner before Release Candidate status is claimed.
