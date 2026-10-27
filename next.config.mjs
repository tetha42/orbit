import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import { generateApps, watchApps } from './scripts/gen-apps.mjs';
import { loadConfigIni } from './scripts/ini-loader.mjs';

// Auto-load one-true config.ini into process.env before Next.js compiles
loadConfigIni();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // BEU_DIST_DIR: a second dev server of the same checkout (e2e: two processes on one database) needs its own build folder.
  distDir: process.env.BEU_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' data: blob:; worker-src 'self' blob:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
  // Allow dev server access across Tailscale and local network
  allowedDevOrigins: [
    '100.124.3.58',
    '100.85.12.34',
    '100.*.*.*',
    '*.ts.net',
    '**.ts.net',
    '192.168.*.*',
    '10.*.*.*',
    ...(process.env.ALLOWED_DEV_ORIGINS
      ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : []),
  ],
};

/**
 * Apps are registered by their manifest alone (src/apps/<id>/manifest.ts); the
 * generated registry is refreshed here, when the server or the build starts,
 * and while `next dev` runs whenever a manifest is added or removed.
 */
export default async function config(phase) {
  await generateApps();
  if (phase === PHASE_DEVELOPMENT_SERVER) watchApps();
  return nextConfig;
}
