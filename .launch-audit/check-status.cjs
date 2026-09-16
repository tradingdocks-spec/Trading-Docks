const { api } = require("./github-pr.cjs");
(async () => { const checks = await api("/commits/5f2909e1718422b1b55bb1427b4617f398490638/check-runs"); console.log(JSON.stringify(checks.check_runs.map(c => ({ name: c.name, status: c.status, conclusion: c.conclusion, url: c.html_url })))); })().catch((e) => { console.error(e.message); process.exitCode = 1; });
