# Trading Docks v82 responsive dashboard patch

This is a cumulative root-level overwrite patch. It includes the v81 Free
signup enforcement and the new v82 responsive dashboard layouts.

## Install application files

1. Open the main Trading Docks GitHub folder containing `.git`, `src`,
   `package.json`, and `.env.local`.
2. Copy this patch's `src` folder into that folder.
3. Choose **Replace the files in the destination**.

Do not leave this patch as a nested folder inside the project.

## Supabase

If `FREE_SIGNUP_DEFAULT.sql` was already applied with v81, do not run it again.
Otherwise run the file in `00_RUN_THIS_IN_SUPABASE` using Supabase SQL Editor.

## Build and deploy

From the main GitHub project folder:

```powershell
npm run build
git add src
git commit -m "Add responsive dashboard layouts"
git push
```

## Responsive behavior

- The current profile is selected automatically:
  - Mobile: 0–767 px
  - Tablet: 768–1199 px
  - Desktop: 1200 px and wider
- Desktop, tablet, and mobile layouts save independently in Supabase.
- Existing layouts are automatically migrated into all three profiles.
- Edit Layout opens a responsive profile selector.
- Mobile modules are always full-width.
- Tablet modules use fewer, wider columns.
- Desktop modules use centered, fluid rows.
- Arrow controls provide touch-friendly reordering.
- The Customize panel becomes a mobile bottom sheet.
- Removing modules causes the remaining cards to recenter immediately.
- Plan entitlements are validated in both the browser and server action.
