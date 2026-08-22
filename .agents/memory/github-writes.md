---
name: GitHub writes from Replit
description: How to publish repository changes when the Git CLI can fetch but cannot authenticate for pushes.
---

The Git CLI may successfully fetch a public GitHub repository while rejecting pushes because no writable credential is configured. Use the attached GitHub connection’s SDK and the Git Data API to create blobs, a tree, one commit, and a non-forced ref update.

**Why:** This preserves a single atomic commit and avoids exposing credentials or using force-push when direct Git authentication is unavailable.

**How to apply:** Verify the remote head still equals the validated base commit, restrict the tree entries to the approved path allowlist, and update `heads/main` with `force: false`. Fetch and align local `main` after success.