import { handleSetupSubmission } from '../route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	return handleSetupSubmission(request);
}
