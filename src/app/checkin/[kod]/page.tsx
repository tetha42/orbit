import { CheckInClient } from '@/app/yoklama/[kod]/CheckInClient';

export const metadata = { title: 'Event Check-In · Orbit Community OS' };

/**
 * Primary English QR check-in route (`/checkin/[kod]`).
 */
export default async function CheckInPage({ params }: { params: Promise<{ kod: string }> }) {
	const { kod } = await params;
	return <CheckInClient kod={decodeURIComponent(kod)} />;
}
