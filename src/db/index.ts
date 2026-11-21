// Single database layer: PostgreSQL.
export {
	isDatabaseConfigured,
	getPgPool,
	checkDatabaseStatus,
	testPostgresConnection,
} from './core/pool';
export { bootstrapAdminEnv } from './core/setup';
export {
	reconfigurePgPool,
	withTransaction,
	ensurePostgresInit,
	getSetupStatus,
	setupFirstAdmin,
} from './core/init';

// Re-export schema definitions
export * from './schema';
export * from './oauth';

// Domain Repositories Re-exports
export * from './repositories/auth.repo';
export * from './repositories/users.repo';
export * from './repositories/files.repo';
export * from './repositories/notifications.repo';
export * from './repositories/members.repo';
export * from './repositories/membership.repo';
export * from './repositories/teams.repo';
export * from './repositories/committees.repo';
export * from './repositories/mailGroups.repo';
export * from './repositories/mailOutbox.repo';
export * from './repositories/privacy.repo';
export * from './repositories/kanban.repo';
export * from './repositories/budget.repo';
export * from './repositories/certificates.repo';
export * from './repositories/inventory.repo';
export * from './repositories/decisions.repo';
export * from './repositories/news.repo';
export * from './repositories/notes.repo';
export * from './repositories/settings.repo';
export * from './repositories/projects.repo';
export * from './repositories/events.repo';
export * from './repositories/security.repo';
export * from './repositories/customization.repo';
export * from './repositories/logs.repo';
export * from './repositories/inspection.repo';
export * from './repositories/chat.repo';
