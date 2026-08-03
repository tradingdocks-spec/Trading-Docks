# Trading Docks v215 — Card Photo Scanner navigation fix

The scanner feature was present in v214, but its menu entry was added only to
the legacy dashboard navigation file.

This release adds **Purchasing → Card Photo Scanner** to both:

- `src/components/dashboard/navigation.ts`
- `src/components/dashboard-v2/navigation.ts`

This ensures the scanner appears in the active sidebar regardless of which
dashboard shell is selected.
