import { withAudit } from '@/lib/audit/withAudit';
import { handleSetupSubmission } from '../route';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/setup/complete` — finalizes first-run setup (including `archetype`
 * preset seeding for `organization_archetype`, `registration_core_fields`, and
 * `team_categories`) via `handleSetupSubmission`.
 */
async function handlePOST(request: Request) {
	return handleSetupSubmission(request);
}

export const POST = withAudit(handlePOST, { action: 'setup.complete.create', target: 'setup.complete' });

