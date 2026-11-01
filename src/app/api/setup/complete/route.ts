import { withAudit } from '@/lib/audit/withAudit';
import { handleSetupSubmission } from '../route';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	return handleSetupSubmission(request);
}

export const POST = withAudit(handlePOST, { action: 'setup.complete.create', target: 'setup.complete' });
