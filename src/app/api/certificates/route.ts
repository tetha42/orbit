import { NextResponse } from 'next/server';
import { getCertificates, createCertificate, deleteCertificate, createEventCertificates, getEventById, getUserById } from '@/db';
import { can, requireApp } from '@/lib/auth/access';
import { withAudit } from '@/lib/audit/withAudit';
import certificatesContract from '@/apps/certificates/certificates.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

const MAX_TITLE_LENGTH = certificatesContract.limits.maxTitleLength;

export async function GET(request: Request) {
	// Previously unauthenticated: with no `userId` this returned every
	// member's certificates to anyone who asked.
	const auth = await requireApp(request, 'certificates', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		const requested = searchParams.get('userId');

		// Members may only list their own; those who manage certificates may list anyone's.
		const userId = can(auth.user, 'certificates', 'manage') ? requested || undefined : auth.user.id;

		const certs = await getCertificates(userId);
		return NextResponse.json(certs);
	} catch (error) {
		console.error('API /api/certificates GET error:', error);
		return NextResponse.json({ error: 'Failed to load certificates.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	// Issuing a certificate mints a publicly verifiable credential, so it is a
	// management action.
	const auth = await requireApp(request, 'certificates', 'manage');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { userId, eventId, pdfUrl, category, language, description } = body;
		const title = typeof body.title === 'string' ? body.title.trim() : '';
		if (!title || title.length > MAX_TITLE_LENGTH) {
			return NextResponse.json(
				{ error: `Title is required (max ${MAX_TITLE_LENGTH} characters).` },
				{ status: 400 }
			);
		}

		// Everyone who attended an event, in one go; those who already hold one are skipped.
		if (body.action === 'bulk') {
			const ev = typeof eventId === 'string' ? await getEventById(eventId) : null;
			if (!ev) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
			const r = await createEventCertificates(ev.id, title, {
				category: typeof category === 'string' ? category : undefined,
				language: typeof language === 'string' ? language : undefined,
				description: typeof description === 'string' ? description.trim() : undefined,
			});
			return NextResponse.json({
				success: true,
				...r,
				message: r.given
					? `Issued certificates to ${r.given} participant(s)${r.alreadyExists ? ` (${r.alreadyExists} already held one)` : ''}.`
					: 'No new participants eligible for a certificate.',
			});
		}

		if (!userId) {
			return NextResponse.json({ error: 'User and title are required.' }, { status: 400 });
		}
		if (!(await getUserById(userId))) {
			return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
		}

		const result = await createCertificate({
			userId,
			title,
			eventId: eventId || undefined,
			pdfUrl: pdfUrl || undefined,
			category: typeof category === 'string' ? category : undefined,
			language: typeof language === 'string' ? language : undefined,
			description: typeof description === 'string' ? description.trim() : undefined,
		});

		return NextResponse.json({ success: true, id: result.id, verificationCode: result.verificationCode });
	} catch (error) {
		console.error('API /api/certificates POST error:', error);
		return NextResponse.json({ error: 'Failed to create certificate.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'certificates.create', target: 'certificate' });

async function handleDELETE(request: Request) {
	const auth = await requireApp(request, 'certificates', 'manage');
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'Certificate ID is required.' }, { status: 400 });
		}

		const deleted = await deleteCertificate(id);
		if (!deleted) {
			return contractErrorResponse(
				certificatesContract,
				'CERTIFICATE_NOT_FOUND',
				'Certificate not found or could not be deleted.'
			);
		}

		return NextResponse.json({ success: true, message: 'Certificate revoked.' });
	} catch (error) {
		console.error('API /api/certificates DELETE error:', error);
		return NextResponse.json({ error: 'Operation could not be completed.' }, { status: 500 });
	}
}

export const DELETE = withAudit(handleDELETE, {
	action: 'certificates.delete',
	target: 'certificate',
	getTargetId: (req) => new URL(req.url).searchParams.get('id'),
});
