# Scanner Agent Phase 1 owner test

Status: implemented web candidate; physical acceptance pending.

This promotion includes the Phase 1 web authorization endpoint, reconnect/pairing/device restoration and pending-capture recovery controls. It excludes private-preview mutation guards, installers/native sources, private artifacts and unrelated reports. Scanner UI remains behind the existing server-verified owner/workspace allowlist. Capture authorization independently enforces that same gate and existing cloud scope before issuing two-minute signed permits.

The production server requires `SCANNER_CAPTURE_SIGNING_KEY`, matching the public key pinned in the owner's private 1.3.0 agent. No signing private key or service-role credential is bundled in the agent or committed. Existing cloud/RLS authority remains unchanged; no migration is included. POS/Square settings and hardware certification are unchanged.

Controlled test: preserve existing CS-000023 and destination; restart 1.3.0, use normal Chrome on production, verify pairing/reconnect and iX500 restoration, then accept exactly one physical card into private cloud capture/review. Do not create another batch or commit inventory. Stop and diagnose a connection failure.

Physical capture, recognition, restart and pairing acceptance must be reported from observation, not inferred from automated tests. Public installer distribution and hardware certification remain pending.
