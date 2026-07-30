# Trading Docks v141 — Polished Entrance Animations

## Included

- Branded transition for `Get started`, `Create your workspace`, and `Log in`.
- Fast dark-glass wipe with a restrained cyan scan edge and Trading Docks mark.
- Coordinated destination-page fade and rise.
- Smooth `Explore the platform` scroll with an arrival reveal on the platform section.
- Modifier-click support so opening links in a new tab still works normally.
- Full `prefers-reduced-motion` support.
- Mobile-safe fixed transition layer with no layout shift.

## Implementation notes

- The navigation delay is limited to 360 ms so the motion feels premium without
  making the product feel slower.
- The transition is CSS-driven and does not add an animation package or image
  asset to the client bundle.
- No Supabase migration is required.
