# Chaos promotion dependency security delta

Reviewed September 27, 2026 against freshly fetched `origin/main` at `13766d473d72451dd164b5ae1ce4baa69ce94f19`.

Conclusion: **PRE-EXISTING BASELINE SECURITY DEBT. No promotion-introduced dependency security regression identified.** The owner's revised gate permits promotion preparation while the separate mobile remediation record remains open. This is not a claim that the baseline vulnerabilities are harmless or fixed.

## Reproducible before/after comparison

Used Node 24.18.0 / npm 11.16.0 for both sides. Extracted main's root/mobile `package.json` and `package-lock.json` directly using `git show origin/main:<path>` into isolated audit directories; copied the promotion's corresponding files into separate directories. Ran `npm audit --package-lock-only --audit-level=high --json --omit=dev` and the same command without `--omit=dev` in each directory. No install, upgrade, lockfile regeneration or audit fix was used.

| Scope | Main high / moderate / critical | Promotion high / moderate / critical | New findings |
| --- | --- | --- | --- |
| Web/root, omit dev | 0 / 0 / 0 | 0 / 0 / 0 | 0 |
| Web/root, all dependencies | 0 / 0 / 0 | 0 / 0 / 0 | 0 |
| Mobile, omit dev | 6 / 19 / 0 | 6 / 19 / 0 | 0 |
| Mobile, all dependencies | 6 / 19 / 0 | 6 / 19 / 0 | 0 |

All npm manifests/lockfiles are identical after Git's CRLF/LF normalization, with zero dependency/version delta. LF-normalized lockfile SHA-256: root `f8a43a8dab47282e7383edd4ef1cf5468350c8a642b2b9a1bcaab97a744eaf4e`; mobile `558146d6b9676f12cf56e539bbcff60f52ad12a4d7df7d8e794070a82dc1d43c`.

Audit package names, advisory IDs, severity, affected ranges, dependency paths and propagated effects are identical. One `fixAvailable` suggestion for `@expo/config` differed between successive registry responses (Expo versus expo-constants major upgrade); it is a remediation recommendation, not a different vulnerability or installed version. Mobile audits honestly retain exit code 1. Counts represent npm vulnerable package entries, including propagated entries, not 25 distinct CVEs.

Machine-readable before/after counts and all 25 package entries with versions/advisories are in `CHAOS_DEPENDENCY_SECURITY_DELTA.json`. Raw audit responses and dependency explanations remain in ignored `.cache/promotion/security-delta/`.

## Exposure review

All 25 entries survive `--omit=dev`; it would be incorrect to dismiss them as npm devDependencies. Expo includes tooling beneath production dependencies. Actual execution roles differ:

| Affected package/version | Existing path and relevant execution context | Promotion delta |
| --- | --- | --- |
| `@xmldom/xmldom` 0.8.13 / 0.9.10 | Expo plist/config plugins and plist: native project XML/plist processing in tooling | None; uploads do not invoke XML/plist parsers |
| `fast-uri` 3.1.5 | expo-dev-launcher → AJV URI/schema resolution, development-client path | None; no mobile launcher/schema/URI changes |
| `image-size` 1.2.1 | Metro asset processing during bundle/build | None; Chaos uploads use root `sharp`, not Metro/image-size |
| `js-yaml` 3.15.1 / 4.3.1 | coverage config, Expo xcpretty and ESLint configuration/tooling | None; promoted input never becomes YAML configuration |
| `nanoid` 3.3.17 | React Navigation/Expo Router runtime identity generation, plus PostCSS tooling | None; inspected navigation callers use ordinary `nanoid()`; no new attacker-controlled zero-size custom generator |
| `postcss` 8.4.49 | Expo Metro CSS transformation/build tooling | None; scan input is not CSS or source-map input; root dependency tree is separate and audits clean |
| `decode-uri-component` 0.2.2 / `query-string` 7.1.3 | React Navigation/Expo Router runtime path/query parsing; malformed deep links are a relevant existing input boundary | None; mobile routes/linking/runtime files are unchanged |
| `uuid` 7.0.3 / `xcode` 3.0.1 | Xcode project/config plugin generation | None; promoted capture identities use platform UUID generation, not this package |

The remaining moderate Expo/config/router/asset entries are propagated dependency findings recorded in the JSON evidence. Runtime-linked packages include React Navigation, Expo Router/linking/constants and their transitive graph; expo-dev-client/launcher serve development builds. This review does not prove every baseline mobile execution path unexploitable. Prioritize deep-link parsing in the separate remediation work.

The [nanoid advisory](https://github.com/advisories/GHSA-2v37-7h3g-55p8) concerns zero-size custom generators; the [URI decoding advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) concerns malformed percent-encoded input. Those conditions inform the source trace above. The [image-size advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) concerns its image parsers; those parsers are not on the promoted upload path.

## New functionality and dependencies

Compared all changed/new application imports and scanner project references with main. The new upload/normalization/review/removal functionality runs in the Next.js root application, not the mobile module tree. The only new third-party package is **NTwain 3.7.6**, pinned in the x86 Windows worker's NuGet lockfile. A fresh `dotnet list scanner-bridge/TwainWorker/TwainWorker.csproj package --vulnerable --include-transitive` reports no vulnerable packages from nuget.org. No reported-vulnerable package is added or version-changed.

The promoted routes already authenticate through the existing server context. Uploaded images are bounded by file/pixel limits and decoded with the unchanged root `sharp` dependency; new normalization increases image processing work but does not invoke any of the 25 vulnerable mobile packages. The scanner worker introduces a real native TWAIN/driver execution path, covered by scanner authorization/recovery tests; installed vendor drivers and unknown vulnerabilities are outside package-audit guarantees. No known reported vulnerability is directly reachable through the promoted functionality, and no relevant existing vulnerable path is newly exposed by this diff.

## Answers and gate

1. New vulnerable dependency: **none identified**; new NTwain audited separately.
2. Vulnerable dependency version changes: **zero**.
3. Severity/count increase: **zero**.
4. Newly exposed relevant vulnerable path: **none identified** by import/call-path comparison.
5. Direct exploit through promoted functionality: **none identified for these reported advisories**. Existing mobile runtime debt remains real.
6. Production graph versus tooling: **both**; all findings survive production-only npm audit, while several actual paths are build/config/development tooling. Runtime navigation/query parsing is explicitly retained as baseline debt.

Follow-up: `MOBILE_BASELINE_SECURITY_REMEDIATION.md`. No dependency remediation belongs in this promotion. Fresh audit/NuGet review and root check validate this review; previous builds, native database and browser/scanner results remain applicable because runtime code/dependency versions were not changed during the review. Physical Ricoh acceptance and real recognition accuracy remain unverified acceptance items, not observed upload/removal/database failures.
