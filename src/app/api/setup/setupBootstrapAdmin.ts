import { NextResponse } from 'next/server';
import { getLegalDocuments, getPgPool, getUserByEmail, seedSetupDefaults } from '@/db';
import { setSystemSettings } from '@/db/repositories/settings.repo';
import { getArchetypePreset } from '@/lib/archetypes';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	REGISTRATION_CORE_SETTINGS_KEY,
	normalizeRegistrationCoreConfig,
} from '@/lib/i18n/data/registrationConfig';
import { buildSmtpUpdates } from '@/lib/mail/smtpSettings';
import { TEAM_CATEGORIES_SETTINGS_KEY, normalizeTeamCategories } from '@/lib/teamCategories';
import type { ParsedSetupPayload } from './setupGuards';

export async function persistInitialBrandingAndDefaults(
	payload: ParsedSetupPayload
): Promise<NextResponse | null> {
	const { communityName, studioName, domain, archetype, smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom } = payload;
	const archetypePreset = getArchetypePreset(archetype);

	// Persist the community identity, organization archetype, and archetype-specific
	// registration/team defaults before creating the administrator. If this fails the
	// setup marker is not written, so the wizard can safely be run again.
	try {
		const archetypeRegistrationConfig = normalizeRegistrationCoreConfig({
			track: {
				visible: true,
				labelTr: archetypePreset.trackLabel.tr,
				labelEn: archetypePreset.trackLabel.en,
				placeholderTr: `Select ${archetypePreset.trackLabel.en.toLowerCase()}`,
				placeholderEn: `Select ${archetypePreset.trackLabel.en.toLowerCase()}`,
				options: archetypePreset.defaultTracks.map((trackName) => ({
					value: trackName,
					labelTr: trackName,
					labelEn: trackName,
				})),
			},
			level: {
				visible: true,
				labelTr: archetypePreset.levelLabel.tr,
				labelEn: archetypePreset.levelLabel.en,
				placeholderTr: `Select ${archetypePreset.levelLabel.en.toLowerCase()}`,
				placeholderEn: `Select ${archetypePreset.levelLabel.en.toLowerCase()}`,
				options: archetypePreset.defaultLevels.map((levelName, idx) => ({
					value: String(idx + 1),
					labelTr: levelName,
					labelEn: levelName,
				})),
			},
			memberId: {
				required: false,
				labelTr: archetypePreset.handleLabel.tr,
				labelEn: archetypePreset.handleLabel.en,
				placeholderTr: DEFAULT_REGISTRATION_CORE_CONFIG.memberId.placeholderTr,
				placeholderEn: DEFAULT_REGISTRATION_CORE_CONFIG.memberId.placeholderEn,
			},
		});
		const archetypeTeamCategories = normalizeTeamCategories(
			archetypePreset.defaultUnitCategories.map((unit) => unit.labelEn)
		);

		const dbSettings: Record<string, string> = {
			club_name: communityName,
			organization_name: communityName,
			club_domain: domain,
			organization_domain: domain,
			university: studioName,
			parent_entity: studioName,
			organization_archetype: archetype,
			[REGISTRATION_CORE_SETTINGS_KEY]: JSON.stringify(archetypeRegistrationConfig),
			[TEAM_CATEGORIES_SETTINGS_KEY]: JSON.stringify(archetypeTeamCategories),
		};
		if (smtpHost) {
			const smtpUpdates = await buildSmtpUpdates({
				host: smtpHost,
				port: smtpPort,
				user: smtpUser,
				pass: smtpPassword,
				from: smtpFrom || `${communityName} <noreply@${domain}>`,
			});
			Object.assign(dbSettings, smtpUpdates);
		}
		await setSystemSettings(dbSettings);
		await seedSetupDefaults(communityName);
		await getLegalDocuments();
		return null;
	} catch (dbSetErr) {
		console.error('[Orbit Setup] Branding/defaults could not be persisted:', dbSetErr);
		return NextResponse.json(
			{ error: 'Setup could not save the initial branding to the database. Please try again.' },
			{ status: 503 }
		);
	}
}

export async function seedDefaultChatRoom(): Promise<void> {
	try {
		await getPgPool().query(
			`INSERT INTO chat_rooms (id, room_type, team_id, name, created_at)
			 VALUES ('room_general', 'general', NULL, 'Orbit General Chat', $1)
			 ON CONFLICT (id) DO UPDATE SET name = 'Orbit General Chat'`,
			[Date.now()]
		);
	} catch (chatErr) {
		console.warn('[Orbit Setup] Chat room seed warning:', chatErr);
	}
}

export async function createAdminSessionResponse(
	request: Request,
	email: string
): Promise<NextResponse> {
	const adminUser = await getUserByEmail(email);
	let sessionToken: string | null = null;
	let sessionUser = null;
	if (adminUser) {
		sessionToken = await establishSession(adminUser, request, 'password');
		sessionUser = await sessionUserOf(adminUser);
	}

	const response = NextResponse.json({
		success: true,
		message: 'Orbit Community OS setup completed successfully.',
		user: sessionUser,
	});

	if (sessionToken) {
		attachSessionCookie(response, sessionToken);
	}

	return response;
}
