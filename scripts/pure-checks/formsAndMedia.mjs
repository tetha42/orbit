import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	fieldAppliesTo,
	fieldInDirectory,
	fieldRequiredFor,
	normalizeFormFieldInput,
	validateAdminEditValues,
	validateFormValues,
} from '../../src/lib/formFields.ts';
import { sniffMedia } from '../../src/lib/media.ts';
import { mediaPreviewKind } from '../../src/core/mediaViewer/index.ts';
import {
	defaultIconForSize,
	identityIconUrl,
	identityIconVersion,
	identityManifestUrl,
} from '../../src/lib/identityIcon.ts';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	defaultLevelValue,
	defaultTrackValue,
	normalizeRegistrationCoreConfig,
} from '../../src/lib/i18n/data/registrationConfig.ts';
import { canUse } from '../../src/core/permissions/index.ts';
import { ALL_MANIFESTS, DEFAULT_DOCK_ORDER, INTERNAL_WINDOW_MANIFESTS, WINDOW_MANIFESTS } from '../../src/apps/index.ts';
import { check } from './runner.mjs';

export function runFormsAndMediaChecks() {
	check('custom form fields: bilingual validation and scoped values', () => {
		const created = normalizeFormFieldInput(
			{
				scope: 'both',
				fieldKey: 'T-Shirt Size!',
				type: 'select',
				labelTr: 'Ti\u015f\u00f6rt Bedeni',
				labelEn: 'T-shirt Size',
				options: [
					{ value: 's', labelTr: 'K\u00fc\u00e7\u00fck', labelEn: 'Small' },
					{ value: 'm', labelTr: 'Orta', labelEn: 'Medium' },
				],
				required: true,
			},
			2
		);
		assert.equal(created.ok, true);
		assert.equal(created.value.fieldKey, 't_shirt_size');
		const field = {
			id: 'ff_1',
			...created.value,
			fieldKey: 'shirt_size',
			enabled: true,
		};
		assert.equal(field.fieldKey, 'shirt_size');
		assert.equal(fieldAppliesTo(field, 'registration'), true);
		assert.equal(fieldAppliesTo(field, 'member'), true);

		const missing = validateFormValues([field], {}, 'registration');
		assert.equal(missing.ok, false);
		assert.ok(missing.errors.shirt_size);

		const invalid = validateFormValues([field], { shirt_size: 'xl' }, 'registration');
		assert.equal(invalid.ok, false);

		const valid = validateFormValues([field], { shirt_size: 'm' }, 'registration');
		assert.deepEqual(valid.clean, { shirt_size: 'm' });

		const noEnglish = normalizeFormFieldInput({ labelTr: 'Sadece T\u00fcrk\u00e7e' });
		assert.equal(noEnglish.ok, false);
	});

	check('form field policy: collect/required/visibility/editability are independent', () => {
		const adminOnly = normalizeFormFieldInput({
			scope: 'member',
			fieldKey: 'phone',
			type: 'tel',
			labelTr: 'Telefon',
			labelEn: 'Phone',
			required: true,
		});
		assert.equal(adminOnly.ok, true);
		assert.equal(adminOnly.value.collectAt, 'admin');
		assert.equal(adminOnly.value.requiredAt, 'admin');
		assert.equal(adminOnly.value.directoryVisibility, 'members');
		const adminField = { id: 'ff_admin', ...adminOnly.value, enabled: true };
		assert.equal(fieldAppliesTo(adminField, 'registration'), false);
		assert.equal(fieldAppliesTo(adminField, 'member'), true);
		assert.equal(fieldRequiredFor(adminField, 'registration'), false);
		assert.equal(fieldRequiredFor(adminField, 'member'), true);

		const hiddenRegistration = normalizeFormFieldInput({
			scope: 'registration',
			fieldKey: 'motivation',
			type: 'textarea',
			labelTr: 'Motivasyon',
			labelEn: 'Motivation',
			required: true,
			directoryVisibility: 'hidden',
		});
		assert.equal(hiddenRegistration.ok, true);
		assert.equal(hiddenRegistration.value.collectAt, 'registration');
		assert.equal(hiddenRegistration.value.directoryVisibility, 'hidden');
		const hiddenField = { id: 'ff_hidden', ...hiddenRegistration.value, enabled: true };
		assert.equal(fieldInDirectory(hiddenField), false);
		assert.equal(fieldAppliesTo(hiddenField, 'registration'), true);
		assert.equal(fieldAppliesTo(hiddenField, 'member'), false);

		const managerEdit = normalizeFormFieldInput({
			scope: 'registration',
			fieldKey: 'internal_note',
			type: 'text',
			labelTr: '\u0130\u00e7 Not',
			labelEn: 'Internal Note',
			adminEditable: true,
		});
		assert.equal(managerEdit.ok, true);
		const managerField = { id: 'ff_note', ...managerEdit.value, enabled: true };
		const editValidation = validateAdminEditValues([managerField], {});
		assert.equal(editValidation.ok, true);
		const editClean = validateAdminEditValues([managerField], { internal_note: 'x' });
		assert.deepEqual(editClean.clean, { internal_note: 'x' });
	});

	check('media sniffing: inline-safe types and active content rejection', () => {
		const png = sniffMedia(
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
			'x.png'
		);
		assert.deepEqual(png, { mime: 'image/png', ext: '.png', kind: 'image' });

		const markdown = sniffMedia(Buffer.from('# Hello\n\n**world**'), 'note.md');
		assert.deepEqual(markdown, { mime: 'text/markdown', ext: '.md', kind: 'text' });

		const fakeHtml = sniffMedia(Buffer.from('<script>alert(1)</script>'), 'x.md');
		assert.equal(fakeHtml?.mime, 'text/markdown', 'content stays inert text, never HTML');

		const html = sniffMedia(Buffer.from('<html><script>alert(1)</script></html>'), 'x.html');
		assert.equal(html, null);

		const icon = readFileSync(new URL('../../public/icon.png', import.meta.url));
		assert.equal(sniffMedia(icon, 'icon.png')?.kind, 'image');
	});

	check('registration core fields: defaults, visibility, labels and options', () => {
		const defaults = normalizeRegistrationCoreConfig({});
		assert.ok(defaults.track.options.length > 0);
		assert.ok(defaults.level.options.length > 0);
		assert.equal(defaults.track.visible, true);
		assert.equal(defaults.memberId.required, false);
		assert.equal(defaultLevelValue(DEFAULT_REGISTRATION_CORE_CONFIG), 1);

		const custom = normalizeRegistrationCoreConfig({
			track: {
				visible: false,
				labelTr: 'Alan',
				labelEn: 'Track',
				options: [
					{ value: 'Alpha', labelTr: 'Alfa', labelEn: 'Alpha' },
					{ value: 'Beta', labelTr: 'Beta', labelEn: 'Beta' },
				],
			},
			level: {
				visible: true,
				labelTr: 'Seviye',
				labelEn: 'Level',
				options: [
					{ value: '2', labelTr: 'Orta', labelEn: 'Mid' },
					{ value: '7', labelTr: '\u0130leri', labelEn: 'Advanced' },
					{ value: '0', labelTr: 'Ge\u00e7ersiz', labelEn: 'Invalid' },
					{ value: '2147483648', labelTr: 'Ta\u015fma', labelEn: 'Overflow' },
				],
			},
			memberId: {
				required: true,
				labelTr: '\u00dcye No',
				labelEn: 'Member No',
				placeholderTr: 'No gir',
				placeholderEn: 'Enter number',
			},
		});
		assert.equal(custom.track.visible, false);
		assert.equal(custom.track.labelEn, 'Track');
		assert.equal(custom.memberId.required, true);
		assert.equal(custom.memberId.labelEn, 'Member No');
		assert.equal(custom.memberId.placeholderTr, 'No gir');
		assert.equal(defaultTrackValue(custom), 'Alpha');
		assert.deepEqual(custom.level.options.map((option) => option.value), ['2', '7']);
		assert.equal(defaultLevelValue(custom), 2);

		const unsafeTrack = normalizeRegistrationCoreConfig({
			track: {
				options: [
					{ value: 'X', labelTr: 'K\u0131sa', labelEn: 'Short' },
					{ value: '<script>', labelTr: 'K\u00f6t\u00fc', labelEn: 'Bad' },
					{ value: 'Valid Track', labelTr: 'Ge\u00e7erli', labelEn: 'Valid' },
				],
			},
		});
		assert.deepEqual(unsafeTrack.track.options.map((option) => option.value), ['Valid Track']);

		const empty = normalizeRegistrationCoreConfig({
			track: { options: [] },
			level: { options: [] },
		});
		assert.ok(empty.track.options.length > 0);
		assert.ok(empty.level.options.length > 0);
	});

	check('media viewer: browser preview kinds and download fallback', () => {
		const item = (name, type) => ({ name, url: `/api/uploads/${name}`, type });
		assert.equal(mediaPreviewKind(item('photo.png', 'image/png')), 'image');
		assert.equal(mediaPreviewKind(item('scan.pdf', 'application/pdf')), 'pdf');
		assert.equal(mediaPreviewKind(item('notes.md', 'text/markdown')), 'text');
		assert.equal(mediaPreviewKind(item('archive.zip', 'application/zip')), 'unsupported');
		assert.equal(mediaPreviewKind(item('clip.mp4', 'video/mp4')), 'video');
		assert.equal(mediaPreviewKind(item('voice.mp3', 'audio/mpeg')), 'audio');
		assert.equal(mediaPreviewKind(item('unknown.bin', 'application/octet-stream')), 'unsupported');
	});

	check('identity icons: versioned favicon/PWA URLs', () => {
		assert.equal(identityIconVersion(null), 'default');
		assert.equal(identityIconVersion('/api/custom-assets/identity/a.png?v=123-abc'), '123-abc');
		assert.equal(identityIconUrl(512, '123-abc'), '/api/identity/icon/512?v=123-abc');
		assert.equal(
			identityIconUrl(512, '123-abc', { maskable: true }),
			'/api/identity/icon/512?v=123-abc&maskable=1'
		);
		assert.equal(identityManifestUrl('123-abc'), '/manifest.webmanifest?v=123-abc');
		assert.equal(defaultIconForSize(32), '/icon.png');
		assert.equal(defaultIconForSize(512), '/icons/icon-512.png');
		assert.equal(defaultIconForSize(512, true), '/icons/icon-maskable-512.png');
	});

	check('media preview: managed window exists but stays out of launcher/dock/roles', () => {
		assert.ok(INTERNAL_WINDOW_MANIFESTS.some((m) => m.id === 'mediaviewer'));
		assert.ok(!WINDOW_MANIFESTS.some((m) => m.id === 'mediaviewer'));
		assert.ok(!DEFAULT_DOCK_ORDER.includes('mediaviewer'));
		assert.ok(!ALL_MANIFESTS.some((m) => m.id === 'mediaviewer' && !('internal' in m && m.internal)));
		assert.ok(canUse({}, 'mediaviewer'), 'the internal preview window is available to every signed-in member');
	});

	check('voice recordings: WebM audio is sniffed as audio, not video', () => {
		const header = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04]);
		assert.equal(sniffMedia(header, 'voice-123.weba')?.mime, 'audio/webm');
		assert.equal(sniffMedia(header, 'clip.webm')?.mime, 'video/webm');
		const m4a = Buffer.alloc(16);
		m4a.write('\0\0\0\x18ftypmp42', 0, 'latin1');
		assert.equal(sniffMedia(m4a, 'voice-123.m4a')?.mime, 'audio/mp4');
	});
}
