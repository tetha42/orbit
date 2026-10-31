import { NextResponse } from 'next/server';
import { getPublicIdentity } from '@/db';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * Public branding for the sign-in screen, the document title and the PWA
 * manifest. It deliberately contains no member data and no settings secrets.
 */
export async function GET() {
	try {
		const identity = await getPublicIdentity();
		return NextResponse.json({ ok: true, identity }, { headers: NO_CACHE });
	} catch {
		// A freshly cloned install has no database yet; the setup wizard still
		// needs a brand to render.
		return NextResponse.json(
			{
				ok: true,
				identity: {
					appName: 'Orbit',
					studio: 'tetha42',
					siteName: 'Orbit Community',
					siteShortName: 'Orbit',
					descriptionTr:
						'Tetha42 tarafından geliştirilen kendi sunucunuzda barındırılan topluluk işletim sistemi.',
					descriptionEn:
						'Self-hosted community operating system engineered by tetha42.',
					domain: 'orbit.local',
					iconUrl: null,
					brandVersion: 'default',
				},
			},
			{ headers: NO_CACHE }
		);
	}
}
