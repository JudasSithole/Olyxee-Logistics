---
name: Artifact router ports
description: How dev preview routing works for this artifact project
---
This project uses the application (artifact) router, not plain `.replit` [[ports]] forwarding for the preview.
**Rule:** the admin web service must listen on the port declared in `artifacts/olyxee-admin/.replit-artifact/artifact.toml` (localPort 23915); the API on 8080 with `/api` paths.
**Why:** the router forwards `/` to 23915. Running Vite on 5000 (the usual Replit webview convention) makes localhost work but the external preview 502s — the router hits a dead port.
**How to apply:** never override PORT in the workflow to something other than the artifact.toml service port; when preview 502s but localhost is 200, check artifact.toml service ports first.

**Rule:** run the admin through the root artifact-managed workflow only; do not add a second manual frontend workflow on the same port.
**Why:** after migration, stale backup registrations and a manual workflow can compete for the artifact port, making the real artifact report a failure even while an orphaned Vite process still serves the page.
**How to apply:** trust the workflow rooted at `artifacts/olyxee-admin`; stop and remove redundant manual workflows before restarting it, and ignore `.migration-backup` services as non-authoritative.
