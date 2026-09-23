// Local source/artifact audit. Reports paths/counts only, never matching values.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const files = new Set([...git("diff", "HEAD", "--name-only", "--diff-filter=ACM"), ...git("ls-files", "--others", "--exclude-standard")]);
files.delete("docs/INVENTORY_REMOVAL_REPAIR_EXECUTION.md"); // Pre-existing, unrelated local report.
function walk(path) { if (!existsSync(path)) return; for (const name of readdirSync(path)) { const file = join(path, name); if (statSync(file).isDirectory()) walk(file); else if (/\.(js|json|html|map)$/.test(file)) files.add(file); } }
walk(".next/static");
const secrets = [];
for (const file of [".local-fixtures/phase7-staging-keys.json", ".local-fixtures/phase7-auth-fixture.json"]) {
  if (!existsSync(file)) continue;
  const data = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  if (Array.isArray(data)) for (const item of data) { if (item.name === "service_role" || item.type === "secret") secrets.push(item.api_key); }
  else for (const user of Object.values(data.users ?? {})) secrets.push(user.password);
}
const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /sb_secret_[A-Za-z0-9_-]{20,}/, /(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/, /AKIA[A-Z0-9]{16}/];
const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (patterns.some(p => p.test(text)) || secrets.some(s => s && text.includes(s))) findings.push(file);
}
const staged = git("diff", "--cached", "--name-only");
const prohibited = staged.filter(p => /(?:^|\/)(?:\.local-fixtures|artifacts|bin|obj)\/|\.(?:pfx|p12|pem|dump|backup|exe|dll)$/i.test(p));
console.log(JSON.stringify({ status: findings.length || prohibited.length ? "FAIL" : "PASS", filesScanned: files.size, secretFindings: findings, prohibitedStagedArtifacts: prohibited, scope: "Changed bridge/web/test/docs and browser bundles; secret patterns and known staging fixture secrets. Not a formal security certification." }, null, 2));
if (findings.length || prohibited.length) process.exitCode = 1;
