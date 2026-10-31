import { NextResponse } from 'next/server';
import { getPublicIdentity } from '@/db';
import { identityIconUrl, identityIconVersion } from '@/lib/identityIcon';

export const dynamic = 'force-dynamic';

/**
 * The installable app manifest follows the community's identity. The product
 * name (Orbit) is fixed; the community name, description and uploaded icon are
 * read from system settings on every request.
 */
export async function GET() {
	let identity;
	try {
		identity = await getPublicIdentity();
	} catch {
		identity = {
			appName: 'Orbit' as const,
			studio: 'tetha42' as const,
			siteName: 'Orbit Community',
			siteShortName: 'Orbit',
			descriptionTr: '',
			descriptionEn: 'Self-hosted community operating system engineered by tetha42.',
			domain: 'orbit.local',
			iconUrl: null,
			brandVersion: 'default',
		};
	}
	const brandVersion = identity.brandVersion || identityIconVersion(identity.iconUrl);
	// The uploaded icon is resized by /api/identity/icon/[size] so the manifest
	// always advertises exact 192/512 sizes. Without an upload the bundled icons
	// remain the fallback.
	const icons = identity.iconUrl
		? [
				{
					src: identityIconUrl(192, brandVersion),
					sizes: '192x192',
					type: 'image/png',
					purpose: 'any',
				},
				{
					src: identityIconUrl(512, brandVersion),
					sizes: '512x512',
					type: 'image/png',
					purpose: 'any',
				},
				{
					src: identityIconUrl(512, brandVersion, { maskable: true }),
					sizes: '512x512',
					type: 'image/png',
					purpose: 'maskable',
				},
		  ]
		: [
				{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
				{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
				{ src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
		  ];
	return NextResponse.json(
		{
			id: '/',
			name: `${identity.siteName} — ${identity.appName}`,
			short_name: identity.siteShortName || identity.appName,
			description: `${identity.appName} Community OS by ${identity.studio} — ${identity.descriptionEn}`,
			lang: 'en',
			start_url: '/?source=pwa',
			scope: '/',
			display: 'fullscreen',
			display_override: ['fullscreen', 'window-controls-overlay', 'standalone', 'minimal-ui'],
			background_color: '#09090b',
			theme_color: '#09090b',
			orientation: 'any',
			icons,
			shortcuts: [
				{
					name: 'Workspace',
					short_name: 'Workspace',
					description: `Open the ${identity.siteName} workspace`,
					url: '/?source=pwa',
				},
				{
					name: 'Verify Credential',
					short_name: 'Verify',
					description: 'Verify a digital certificate or official document',
					url: '/verify',
				},
			],
		},
		{
			headers: {
				'Content-Type': 'application/manifest+json',
				'Cache-Control': 'no-store',
			},
		}
	);
}
