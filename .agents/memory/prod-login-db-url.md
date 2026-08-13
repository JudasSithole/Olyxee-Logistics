---
name: Production database URL guidance
description: Diagnose malformed database connection URLs without storing credentials.
---

# Production database URL guidance

Special characters in database passwords must be percent-encoded when used in a connection URI. A malformed URI can look like an authentication or query failure because the driver may parse part of the password as the hostname.

Never store production connection strings, passwords, database usernames, project identifiers, or hostnames in repository files. Keep them in the deployment platform's encrypted environment-variable store and rotate any credential that has entered Git history.

After changing a deployment environment variable, redeploy the application and verify database connectivity with a least-privilege health check.
