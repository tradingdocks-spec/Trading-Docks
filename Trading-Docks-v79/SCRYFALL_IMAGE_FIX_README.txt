TRADING DOCKS — CORRECTED HOMEPAGE IMAGE FIX

ROOT CAUSE FOUND

The homepage does not render:

  src/components/marketing/LiveMarketIntelligence.tsx

It renders:

  src/components/Landing/MarketSection.tsx

That component reads its images from:

  src/components/Landing/landing-data.ts

The previous fixes changed a component that was not being used by the
homepage. The active landing-data file still contained four stale direct
cards.scryfall.io URLs.

CORRECTED FILES

src/components/Landing/MarketSection.tsx
src/components/Landing/landing-data.ts
src/app/api/landing-card-image/[set]/[number]/route.ts

THE ACTIVE HOMEPAGE NOW USES

/api/landing-card-image/mps/16?version=small
/api/landing-card-image/all/28?version=small
/api/landing-card-image/ltr/246?version=small
/api/landing-card-image/3ed/290?version=small

These are same-origin URLs. The Next.js route retrieves the exact Scryfall
printing server-side and streams the image to the browser.

TEST AFTER INSTALLING

http://localhost:3000/api/landing-card-image/mps/16?version=small

That URL should display Mana Crypt.

Then clear the cache and restart:

Ctrl + C
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev

The root-level duplicate page.tsx and LiveMarketIntelligence.tsx files from the
uploaded ZIP were removed because they are not part of the actual src tree and
made it harder to identify which files were active.
