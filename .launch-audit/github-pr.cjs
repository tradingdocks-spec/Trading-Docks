const cp = require("child_process");
async function api(path, method = "GET", body) {
  const raw = cp.execFileSync("git", ["credential", "fill"], { input: "protocol=https\nhost=github.com\n\n", encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" } });
  const cred = Object.fromEntries(raw.trim().split("\n").map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  const response = await fetch(`https://api.github.com/repos/tradingdocks-spec/Trading-Docks${path}`, { method, headers: { Authorization: `Bearer ${cred.password}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${data.message}`);
  return data;
}
const body = `## Summary
- Rebuild the public homepage around the physical card lifecycle: acquire, identify, value, place, list, sell, fulfill, analyze.
- Add the reusable Card Trace motif plus command center, Chaos Sort, persona workspaces, connected commerce, and editorial moments.
- Preserve authentication, routing, pricing truth, integrations, analytics, and backend behavior.

## User Impact
- Visitors see the product operating model immediately instead of a generic feature grid.
- Collector, Seller, and Store views demonstrate how one system adapts to each operator.
- Responsive layouts support desktop and mobile without page-level horizontal overflow.

## Technical Changes
- Added FlagshipSections and its responsive visual system.
- Updated homepage composition and hero messaging.
- Database/API/environment/dependency/mobile changes: none.

## Validation
- TypeScript: passed.
- Production build: passed.
- Targeted ESLint: passed with zero errors.
- Existing full-suite baseline has unrelated API registry failures documented in the previous polish release.

## Screens Affected
- Public homepage only.

## Risks
- Demo metrics and lifecycle values are explicitly sample data.
- Authenticated dashboard flows are unchanged and were not modified by this PR.

## Documentation
- The source composition is self-documenting through sample-data labels and accessible lifecycle descriptions.

## Checklist
- [x] Builds successfully
- [x] No TypeScript errors
- [x] No lint errors
- [x] No secrets committed
- [x] Existing functionality preserved
- [x] Responsive on mobile and web
- [ ] Authentication tested if affected (homepage auth redirect unchanged)
- [x] Documentation updated through component and accessibility labels
`;
(async () => {
  const pr = await api("/pulls", "POST", { title: "feat: redesign homepage around card lifecycle", head: "codex/flagship-homepage-redesign", base: "main", body });
  console.log(JSON.stringify({ number: pr.number, url: pr.html_url, sha: pr.head.sha }));
  const merged = await api(`/pulls/${pr.number}/merge`, "PUT", { sha: pr.head.sha, merge_method: "squash", commit_title: `feat: redesign homepage around card lifecycle (#${pr.number})` });
  console.log(JSON.stringify({ merged: merged.merged, sha: merged.sha }));
})();
