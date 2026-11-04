import { CheckInClient } from './CheckInClient';

export const metadata = { title: 'Event Check-In · Orbit Community OS' };

/**
 * Primary English QR check-in route (`/checkin/[code]`).
 */
export default async function CheckInPage({ params }: { params: Promise<{ code: string }> }) {
	const { code } = await params;
	return <CheckInClient code={decodeURIComponent(code)} />;
}
