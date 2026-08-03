# Trading Docks v228 — UI 2.0 Typography System

## Desktop readability standards

- 12px minimum for captions, overlines, metadata, and table headers
- 13px minimum for compact controls and secondary copy
- 14px standard body, navigation, input, select, and button text
- Larger, more readable Orders table rows and financial values
- Consistent line-height and font smoothing across authenticated pages

## Global legacy normalization

Trading Docks contains thousands of legacy arbitrary Tailwind sizes such as
`text-[7px]`, `text-[8px]`, `text-[9px]`, and `text-[10px]`.

Rather than requiring fragile edits across hundreds of files, the authenticated
desktop shell now applies a controlled readability floor in `globals.css`.
Mobile layouts remain unchanged.

## Semantic tokens

New reusable classes:

- `td-type-display`
- `td-type-page-title`
- `td-type-section-title`
- `td-type-card-title`
- `td-type-body`
- `td-type-body-small`
- `td-type-caption`
- `td-type-overline`

A TypeScript token map is available at:

`src/lib/design-system/typography.ts`
