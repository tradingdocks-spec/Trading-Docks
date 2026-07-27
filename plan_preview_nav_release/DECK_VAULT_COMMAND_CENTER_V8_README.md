# Trading Docks Deck Vault — Command Center V8

- Fixed the standalone Change Commander button.
- Removed the obsolete Choose Printing action.
- Added Quick Add Basics for Plains, Island, Swamp, Mountain, and Forest.
- Exact basic-land searches now work through the regular card search.
- Replaced the yellow x1 circle with a quieter footer treatment.
- Singletons show `Single copy`; multiples and basic lands show copy totals.
- Added a subtle technical grid and more structured category surfaces.

Install by replacing matching files, clearing `.next`, and restarting:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
