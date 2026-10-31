import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getSystemSettings, setSystemSettings } from '@/db';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { invalidateCache } from '@/lib/server/cache';
import { updateConfigIniSync } from '@/lib/server/iniWriter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const settings = await getSystemSettings();
		return NextResponse.json({
			kulupAdi: settings.kulup_adi || 'Orbit Community',
			universite: settings.universite || 'tetha42',
			kulupDomain: settings.kulup_domain || 'orbit.local',
			imza1Ad: settings.imza1_ad || '',
			imza1Unvan: settings.imza1_unvan || 'Topluluk Lideri',
			imza2Ad: settings.imza2_ad || '',
			imza2Unvan: settings.imza2_unvan || 'Stüdyo Koordinatörü',
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
			kulupAdi,
			universite,
			kulupDomain,
			imza1Ad,
			imza1Unvan,
			imza2Ad,
			imza2Unvan,
		} = body;

		const updates: Record<string, string> = {};
		const clean = (val: unknown, maxLen = 100) =>
			typeof val === 'string' ? val.trim().slice(0, maxLen) : '';

		if (kulupAdi !== undefined) {
			const name = clean(kulupAdi);
			if (!name) return NextResponse.json({ error: 'Topluluk adı boş bırakılamaz.' }, { status: 400 });
			updates.kulup_adi = name;
		}
		if (universite !== undefined) {
			const studio = clean(universite);
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
			updates.universite = 'tetha42';
		}
		if (kulupDomain !== undefined) {
			const domain = clean(kulupDomain);
			if (!domain) return NextResponse.json({ error: 'Topluluk alan adı boş bırakılamaz.' }, { status: 400 });
			updates.kulup_domain = domain;
		}
		if (imza1Ad !== undefined) updates.imza1_ad = clean(imza1Ad);
		if (imza1Unvan !== undefined) updates.imza1_unvan = clean(imza1Unvan) || 'Topluluk Lideri';
		if (imza2Ad !== undefined) updates.imza2_ad = clean(imza2Ad);
		if (imza2Unvan !== undefined) updates.imza2_unvan = clean(imza2Unvan) || 'Stüdyo Koordinatörü';

		if (Object.keys(updates).length === 0) {
			return NextResponse.json({ ok: true, message: 'Güncellenecek alan bulunamadı.' });
		}

		await setSystemSettings(updates);

		void logSystemEvent({
			servis: 'settings',
			seviye: 'INFO',
			mesaj: `Topluluk kimliği güncellendi (${auth.user.ad} ${auth.user.soyad})`,
			detay: updates,
		});

		// Also sync with runtime configuration
		try {
			const clubPresetUpdates: Record<string, string> = {};
			if (updates.kulup_adi !== undefined) clubPresetUpdates.name = updates.kulup_adi;
			if (updates.kulup_domain !== undefined) clubPresetUpdates.domain = updates.kulup_domain;
			if (updates.universite !== undefined) clubPresetUpdates.university = updates.universite;
			if (updates.imza1_ad !== undefined) clubPresetUpdates.president_name = updates.imza1_ad;
			if (updates.imza1_unvan !== undefined) clubPresetUpdates.president_title = updates.imza1_unvan;
			if (updates.imza2_ad !== undefined) clubPresetUpdates.advisor_name = updates.imza2_ad;
			if (updates.imza2_unvan !== undefined) clubPresetUpdates.advisor_title = updates.imza2_unvan;

			if (Object.keys(clubPresetUpdates).length > 0) {
				updateConfigIniSync({ club_preset: clubPresetUpdates });
			}
		} catch (iniErr) {
			console.warn('Failed to sync community settings to runtime configuration:', iniErr);
		}

		invalidateCache('kulup_bilgileri');

		const fresh = await getSystemSettings();
		return NextResponse.json({
			ok: true,
			success: true,
			settings: {
				kulupAdi: fresh.kulup_adi,
				universite: fresh.universite,
				kulupDomain: fresh.kulup_domain,
				imza1Ad: fresh.imza1_ad,
				imza1Unvan: fresh.imza1_unvan,
				imza2Ad: fresh.imza2_ad,
				imza2Unvan: fresh.imza2_unvan,
			},
		});
	} catch (error) {
		console.error('API /api/settings/community PATCH error:', error);
		return NextResponse.json({ error: 'Topluluk ayarları kaydedilemedi.' }, { status: 500 });
	}
}
