# Mobile Store Release Checklist

Status: Planned. Trading Docks Mobile is not yet certified as a Release Candidate.

Release severity: BLOCKER until physical-device QA, store metadata, legal URLs, production identifiers, and production-build gates are verified.

## iOS

| Item | Current status | Release requirement |
| --- | --- | --- |
| Bundle identifier | Implemented: `com.tradingdocks.app`. | Confirm Apple Developer account ownership. |
| Version/build | Partially Implemented: app version is `0.5.0`; EAS remote auto-increment is configured. | Set release version and build number. |
| Icon | Implemented assets referenced. | Visual QA on device and App Store Connect. |
| Splash | Implemented dark branded splash. | Device QA for white flash and transition. |
| Privacy disclosures | Planned. | Complete App Privacy questionnaire. |
| Privacy URL | Requires Production Configuration. | Publish approved privacy policy. |
| Terms URL | Requires Production Configuration. | Publish approved terms. |
| Support URL | Requires Production Configuration. | Publish support page/email flow. |
| Sign in with Apple | Partially Implemented entry point. | Required if other social sign-in remains; device QA needed. |
| Subscriptions | Planned. | Configure StoreKit products/subscription group, restore purchases, metadata, screenshots, and review notes if paid mobile upgrades ship. |
| Camera permission copy | Implemented in `app.json`. | Verify on device. |
| Encryption declaration | Implemented: `ITSAppUsesNonExemptEncryption` false. | Confirm with legal/security. |
| Age rating | Planned. | Complete in App Store Connect. |
| Screenshots | Planned. | Capture after physical QA on final visuals. |
| Test/demo account | Planned. | Provide if Review cannot self-register safely. |
| TestFlight | Planned. | Build and distribute only after validation and product-owner approval. |
| Production build | Planned. | `eas build --platform ios --profile production`. |
| Submission | Planned. | `eas submit --platform ios` only after approval. |

## Android

| Item | Current status | Release requirement |
| --- | --- | --- |
| Application id | Requires Production Configuration: no explicit `android.package` is set in `mobile/app.json`, and `expo config --type prebuild` currently resolves `com.placeholder.appid`. | Add/confirm final package before Play release. |
| Version code | Planned through EAS remote auto-increment. | Confirm production sequence. |
| AAB | Planned. | Build with production profile. |
| Adaptive icon | Implemented assets referenced. | Visual QA in launcher. |
| Data Safety | Planned. | Complete based on privacy audit. |
| Privacy URL | Requires Production Configuration. | Publish approved privacy policy. |
| Terms URL | Requires Production Configuration. | Publish approved terms. |
| Content rating | Planned. | Complete in Play Console. |
| Screenshots/feature graphic | Planned. | Capture after final device QA. |
| Internal test | Planned. | Run before production rollout. |
| Production release | Planned. | Submit only after product-owner approval. |

## EAS Profiles

- Implemented: `development`, `preview`, and `production` profiles exist in `mobile/eas.json`.
- Implemented: production auto-increment is enabled.
- Requires Production Configuration: production environment values, Android package, store credentials, and diagnostics/dev-route exclusion validation.

## Release Commands

```bash
cd mobile
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

Do not submit to App Review or Play production without explicit product-owner approval.

## Exit Criteria

- Root TypeScript passes.
- Mobile TypeScript passes.
- Focused ESLint passes for changed files.
- Full mobile tests pass.
- Expo Web export passes.
- Expo config prebuild passes.
- `expo install --check` passes.
- Apple OCR autolinking search and resolve include the native OCR module.
- Production builds hide diagnostics and development routes.
- Billing architecture is approved or paid mobile purchase UI is disabled.
- Physical-device QA is complete and documented.
