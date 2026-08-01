# Email Setup Routing Fix — v177

- `Start setup` now routes **Order email tracking** directly into the guided email wizard.
- The chosen marketplace is carried into Step 1 automatically.
- TCGplayer CSV setup now opens the real semi-sync upload screen.
- Email-capable marketplaces share the same clear setup workflow.
- Connection preferences are saved before the setup screen opens.
- No Supabase migration is required.

Validation: focused ESLint (no errors), TypeScript, and the full 85-route Next.js production build.
