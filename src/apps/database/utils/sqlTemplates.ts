export interface SqlSystemTemplate {
	titleKey: string;
	descKey: string;
	title: string;
	desc: string;
	sql: string;
}

export const SQL_SYSTEM_TEMPLATES: SqlSystemTemplate[] = [
	{
		titleKey: 'dbSqlTplDiskTitle',
		descKey: 'dbSqlTplDiskDesc',
		title: 'Disk Usage: Largest Tables & Indexes',
		desc: 'Lists the actual disk space used by PostgreSQL tables and indexes.',
		sql: `SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 50;`,
	},
	{
		titleKey: 'dbSqlTplConnectionsTitle',
		descKey: 'dbSqlTplConnectionsDesc',
		title: 'Active Database Connections and Locks',
		desc: 'Lists currently running connections, their state and active queries.',
		sql: `SELECT
  pid,
  usename AS "user",
  client_addr AS ip_address,
  state AS status,
  NOW() - query_start AS duration,
  query AS query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start DESC;`,
	},
	{
		titleKey: 'dbSqlTplStatsTitle',
		descKey: 'dbSqlTplStatsDesc',
		title: 'Table Statistics & Dead Tuples',
		desc: 'Live rows, deleted but not yet cleaned (dead) rows, and VACUUM history.',
		sql: `SELECT
  relname AS table_name,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_ratio_percent,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;`,
	},
	{
		titleKey: 'dbSqlTplIndexTitle',
		descKey: 'dbSqlTplIndexDesc',
		title: 'Index Usage Efficiency',
		desc: 'Shows how often tables use Index Scan instead of Sequential Scan.',
		sql: `SELECT
  relname AS table_name,
  seq_scan AS order_scan,
  idx_scan AS index_scan,
  ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS index_usage_percent
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 50;`,
	},
];
