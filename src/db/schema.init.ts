import type { PoolClient } from 'pg';
import { createCoreTables } from './schema/init/coreTables';
import { createSecurityAndOpsTables } from './schema/init/securityAndOpsTables';
import { createCommunityAndChatTables, seedInitialDatabaseState } from './schema/init/communityAndChatTables';

export async function runSchemaMigrations(client: PoolClient): Promise<void> {
	await createCoreTables(client);
	await createSecurityAndOpsTables(client);
	await createCommunityAndChatTables(client);
	await seedInitialDatabaseState(client);
}
