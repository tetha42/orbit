#!/bin/sh
set -e

echo "🚀 [Orbit] Starting Orbit Community OS by tetha42..."

# ------------------------------------------------------------------
# Configuration checks
# ------------------------------------------------------------------
if [ -z "$DATABASE_URL" ]; then
	echo "❌ [Orbit] DATABASE_URL is not set." >&2
	echo "   Provide the PostgreSQL connection string as an environment variable" >&2
	echo "   (e.g. postgresql://orbit:<password>@db:5432/orbit)." >&2
	exit 1
fi

# WebAuthn/passkeys need an explicit origin when running behind a proxy, because
# the browser-facing scheme and host are not what the container sees.
if [ -n "$SITE_ADDRESS" ] && [ "$SITE_ADDRESS" != ":80" ] && [ -z "$WEBAUTHN_ORIGIN" ]; then
	echo "ℹ️  [Orbit] WEBAUTHN_ORIGIN is not set for SITE_ADDRESS=$SITE_ADDRESS."
	echo "   Passkeys must match the origin seen by the browser;"
	echo "   consider setting WEBAUTHN_ORIGIN=https://$SITE_ADDRESS."
fi

# Outside development the portal runs as an installed PWA, and browsers only
# offer installation from a secure context.
# (TLS terminated by a proxy in front of this container is fine — ignore this warning.)
if [ "$NODE_ENV" = "production" ] && { [ -z "$SITE_ADDRESS" ] || [ "$SITE_ADDRESS" = ":80" ]; }; then
	echo "⚠️  [Orbit] SITE_ADDRESS is configured for plain HTTP (:80)." >&2
	echo "   In production, browsers only offer PWA installation over HTTPS." >&2
	echo "   Assign a domain to SITE_ADDRESS or terminate TLS at your reverse proxy." >&2
fi

# ------------------------------------------------------------------
# Next.js
# ------------------------------------------------------------------
echo "📦 [Next.js] Starting production server on 127.0.0.1:3000..."
npm run start -- -p 3000 &
NEXT_PID=$!

echo "⏳ [Caddy] Waiting for Next.js server to become ready..."
waited=0
while ! nc -z 127.0.0.1 3000; do
	sleep 0.2
	waited=$((waited + 1))
	if [ "$waited" -gt 150 ]; then
		echo "❌ [Next.js] Failed to start within 30 seconds." >&2
		kill -TERM "$NEXT_PID" 2>/dev/null || true
		exit 1
	fi
done
echo "✅ [Next.js] Ready!"

# ------------------------------------------------------------------
# Caddy
# ------------------------------------------------------------------
echo "🛡️ [Caddy] Listening on $SITE_ADDRESS and forwarding traffic to Next.js..."
caddy run --config /app/Caddyfile --adapter caddyfile &
CADDY_PID=$!

# Stop both processes together so a restart never leaves a half-dead container.
shutdown() {
	echo "Shutting down..."
	kill -TERM "$NEXT_PID" "$CADDY_PID" 2>/dev/null || true
}
trap shutdown SIGTERM SIGINT

# Either process exiting takes the container down: a container that stays "up"
# with a dead Next.js behind Caddy would keep passing its healthcheck.
wait "$NEXT_PID" || true
shutdown
wait 2>/dev/null || true
