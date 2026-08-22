---
name: Artifact router ports
description: How dev preview routing works for this artifact project
---
This project uses the application (artifact) router, not plain `.replit` [[ports]] forwarding for the preview.
**Rule:** the admin web service must listen on the port declared in `artifacts/olyxee-admin/.replit-artifact/artifact.toml` (localPort 23915); the API on 8080 with `/api` paths.
**Why:** the router forwards `/` to 23915. Running Vite on 5000 (the usual Replit webview convention) makes localhost work but the external preview 502s — the router hits a dead port.
**How to apply:** never override PORT in the workflow to something other than the artifact.toml service port; when preview 502s but localhost is 200, check artifact.toml service ports first.

**Rule:** run both the admin and API through their root artifact-managed workflows only; do not add manual duplicates on ports 23915 or 8080.
**Why:** after migration, stale backup registrations and manual workflows can occupy artifact ports, making managed services fail while orphaned processes keep serving incomplete or stale behavior.
**How to apply:** trust workflows rooted at `artifacts/olyxee-admin` and `artifacts/api-server`; remove manual duplicates before restarting them, and ignore `.migration-backup` services as non-authoritative.
