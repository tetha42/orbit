# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch and the latest tagged
release. Older tags may not receive backports.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting / Security Advisory flow for this
repository. Include:

- affected route or component
- reproduction steps or a proof of concept
- impact and required privileges
- suggested fix, if you have one

Do not include real credentials, session cookies, TOTP seeds, or personal data
belonging to other members. Replace them with test values.

## Scope

High-priority areas:

- authentication, sessions, passkeys and 2FA
- RBAC and privilege escalation
- Database Studio and Terminal access
- file upload/download and path traversal
- legal-consent evidence and personal-data export/anonymization
- mail outbox approval and SMTP/IMAP credentials
- SQL injection and unsafe dynamic identifiers

## Deployment warning

Only the isolated local development profile (`infra/docker/docker-compose.dev.yml`)
sets a default PostgreSQL password (`orbit_dev_2026`). Production deployments using
`infra/docker/docker-compose.yml` require an explicit `POSTGRES_PASSWORD` with no
default, and should restrict the database port to the private network, enable TLS
at the reverse proxy, configure `AUTH_SECRET` plus WebAuthn origin/RP ID for the
final domain, keep `data/orbit.setup.token` private, and never enable
`ORBIT_DEV_AUTO_UNLOCK=1` outside local loopback development.
