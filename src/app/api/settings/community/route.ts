import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getSystemSettings, setSystemSettings } from '@/db';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { invalidateCache } from '@/server/cache';
import { updateConfigIniSync } from '@/server/iniWriter';
import { DEFAULT_ARCHETYPE, isOrganizationArchetype } from '@/lib/archetypes';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const settings = await getSystemSettings();
		const archetype = isOrganizationArchetype(settings.organization_archetype)
			? settings.organization_archetype
			: DEFAULT_ARCHETYPE;
		return NextResponse.json({
			clubName: settings.club_Name || 'Orbit Community',
			university: settings.university || 'tetha42',
			clubDomain: settings.club_domain || 'orbit.local',
			archetype,
			organizationArchetype: archetype,
			signature1Name: settings.signature1_Name || '',
			signature1Rank: settings.signature1_Rank || 'Topluluk Lideri',
			signature2Name: settings.signature2_Name || '',
			signature2Rank: settings.signature2_Rank || 'Stüdyo Koordinatörü',
		});
	} catch (error) {
		console.error('API /api/settings/community GET error:', error);
		return NextResponse.json({ error: 'Topluluk ayarları okunamadı.' }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json().catch(() => ({}));
		const {
			clubName,
			university,
			clubDomain,
			archetype,
			organizationArchetype,
			signature1Name,
			signature1Rank,
			signature2Name,
			signature2Rank,
		} = body;

		const updates: Record<string, string> = {};
		const clean = (val: unknown, maxLen = 100) =>
			typeof val === 'string' ? val.trim().slice(0, maxLen) : '';

		if (clubName !== undefined) {
			const name = clean(clubName);
			if (!name) return NextResponse.json({ error: 'Topluluk adı boş bırakılamaz.' }, { status: 400 });
			updates.club_Name = name;
		}
		if (university !== undefined) {
			const studio = clean(university);
			// The studio is the product's maker and is not white-label editable.
			if (studio && studio !== 'tetha42') {
				return NextResponse.json(
					{
						error: 'The studio name (tetha42) is immutable.',
						code: 'IMMUTABLE_IDENTITY',
					},
					{ status: 400 }
				);
			}
			if (!studio) {
				return NextResponse.json({ error: 'Studio name cannot be empty.' }, { status: 400 });
			}
			updates.university = 'tetha42';
		}
		if (clubDomain !== undefined) {
			const domain = clean(clubDomain);
			if (!domain) return NextResponse.json({ error: 'Topluluk alan adı boş bırakılamaz.' }, { status: 400 });
			updates.club_domain = domain;
		}
		const rawArchetype = archetype ?? organizationArchetype;
		if (rawArchetype !== undefined) {
			if (!isOrganizationArchetype(rawArchetype)) {
				return NextResponse.json({ error: 'Geçersiz organizasyon arketipi.' }, { status: 400 });
			}
			updates.organization_archetype = rawArchetype;
		}
		if (signature1Name !== undefined) updates.signature1_Name = clean(signature1Name);
		if (signature1Rank !== undefined) updates.signature1_Rank = clean(signature1Rank) || 'Topluluk Lideri';
		if (signature2Name !== undefined) updates.signature2_Name = clean(signature2Name);
		if (signature2Rank !== undefined) updates.signature2_Rank = clean(signature2Rank) || 'Stüdyo Koordinatörü';

		if (Object.keys(updates).length === 0) {
			return NextResponse.json({ ok: true, message: 'Güncellenecek alan bulunamadı.' });
		}

		await setSystemSettings(updates);

		void logSystemEvent({
			service: 'settings',
			level: 'INFO',
			message: `Topluluk kimliği güncellendi (${auth.user.firstName || auth.user.name || ""} ${auth.user.lastName || auth.user.surname || ""})`,
			detail: updates,
		});

		// Also sync with runtime configuration
		try {
			const clubPresetUpdates: Record<string, string> = {};
			if (updates.club_Name !== undefined) clubPresetUpdates.name = updates.club_Name;
			if (updates.club_domain !== undefined) clubPresetUpdates.domain = updates.club_domain;
			if (updates.university !== undefined) clubPresetUpdates.university = updates.university;
			if (updates.signature1_Name !== undefined) clubPresetUpdates.president_name = updates.signature1_Name;
			if (updates.signature1_Rank !== undefined) clubPresetUpdates.president_title = updates.signature1_Rank;
			if (updates.signature2_Name !== undefined) clubPresetUpdates.advisor_name = updates.signature2_Name;
			if (updates.signature2_Rank !== undefined) clubPresetUpdates.advisor_title = updates.signature2_Rank;

			if (Object.keys(clubPresetUpdates).length > 0) {
				updateConfigIniSync({ club_preset: clubPresetUpdates });
			}
		} catch (iniErr) {
			console.warn('Failed to sync community settings to runtime configuration:', iniErr);
		}

		invalidateCache('kulup_bilgileri');

		const fresh = await getSystemSettings();
		const freshArchetype = isOrganizationArchetype(fresh.organization_archetype)
			? fresh.organization_archetype
			: DEFAULT_ARCHETYPE;
		return NextResponse.json({
			ok: true,
			success: true,
			archetype: freshArchetype,
			settings: {
				clubName: fresh.club_Name,
				university: fresh.university,
				clubDomain: fresh.club_domain,
				archetype: freshArchetype,
				organizationArchetype: freshArchetype,
				signature1Name: fresh.signature1_Name,
				signature1Rank: fresh.signature1_Rank,
				signature2Name: fresh.signature2_Name,
				signature2Rank: fresh.signature2_Rank,
			},
		});
	} catch (error) {
		console.error('API /api/settings/community PATCH error:', error);
		return NextResponse.json({ error: 'Topluluk ayarları kaydedilemedi.' }, { status: 500 });
	}
}

export async function PUT(request: Request) {
	return PATCH(request);
}

export async function POST(request: Request) {
	return PATCH(request);
}
