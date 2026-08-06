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
- Home, Collection, Card Detail, Storage Locations.
- Scanner, Scanner Session Review, Scanner Recovery.
- Trade Binder and Wishlist.
- Deal Desk and Seller/Signals.
- Profile and Settings.
- Admin Command Center summary and access denial.
- Dev-only Design System route with flag enabled and disabled.

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
- Torch, Capture, and Search hide during capture, lookup, saving, open sheets, added feedback, and remove-card lockout.
- Recognized result does not show a primary confidence percentage.
- Failed result shows only compact Retake/Search recovery.
- Added/remove-card feedback remains brief and does not become a full result card.
- Session preservation after app background/foreground.
- Failed queued scan retry.
- Failed queued scan discard confirmation.

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
