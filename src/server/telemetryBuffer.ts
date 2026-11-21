import { getPgPool } from '@/db/core/pool';
import { dispatchLog, type SystemLog } from '@/db/repositories/logs.repo';

export interface HttpTelemetryEvent {
	timestamp: number;
	method: string;
	path: string;
	statusCode: number;
	latencyMs: number;
	ip: string;
	userAgent?: string;
	riskScore?: number;
	requestId?: string;
	userId?: string | null;
	detail?: Record<string, unknown>;
}

/**
 * High-throughput bounded in-memory telemetry buffer.
 *
 * 1. Emits events immediately to dispatchLog with service: 'http' (<10ms UI latency for SSE stream).
 * 2. Debounces multi-row INSERT INTO system_logs every 500ms or when batch reaches 50 items.
 * 3. Upper bound: 5,000 items queue to prevent memory leak.
 */
export class TelemetryBatchBuffer {
	private queue: HttpTelemetryEvent[] = [];
	private maxQueueSize = 5000;
	private batchSize = 50;
	private flushIntervalMs = 500;
	private timer: NodeJS.Timeout | null = null;
	private isFlushing = false;
	private lastPruneTime = 0;

	public enqueue(event: HttpTelemetryEvent): void {
		const level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' =
			event.statusCode >= 500 ? 'ERROR' : event.statusCode >= 400 ? 'WARN' : 'INFO';
		const message = `[HTTP] ${event.method} ${event.path} ${event.statusCode} (${event.latencyMs}ms)`;

		const logItem: SystemLog = {
			id: Math.floor(Date.now() * 1000 + Math.random() * 1000),
			time: event.timestamp,
			level,
			service: 'http',
			message,
			detail: {
				method: event.method,
				path: event.path,
				statusCode: event.statusCode,
				latencyMs: event.latencyMs,
				userAgent: event.userAgent || null,
				riskScore: event.riskScore || 0,
				requestId: event.requestId || null,
				...event.detail,
			},
			userId: event.userId ?? null,
			ip: event.ip,
		};

		// 1. Instant dispatch for real-time SSE stream in SoC Studio (<10ms)
		try {
			dispatchLog(logItem);
		} catch {
			// ignore dispatch failure
		}

		// 2. Queue for batched database write
		if (this.queue.length >= this.maxQueueSize) {
			this.queue.shift();
		}
		this.queue.push(event);

		if (this.queue.length >= this.batchSize) {
			void this.flush();
		} else if (!this.timer) {
			this.timer = setTimeout(() => {
				this.timer = null;
				void this.flush();
			}, this.flushIntervalMs);
			this.timer.unref?.();
		}
	}

	public async flush(): Promise<void> {
		if (this.isFlushing || this.queue.length === 0) return;
		this.isFlushing = true;

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		const batch = this.queue.splice(0, this.batchSize * 2);

		try {
			const pool = getPgPool();
			if (!pool) {
				this.isFlushing = false;
				return;
			}

			const valueClauses: string[] = [];
			const params: unknown[] = [];
			let paramIdx = 1;

			for (const evt of batch) {
				const level = evt.statusCode >= 500 ? 'ERROR' : evt.statusCode >= 400 ? 'WARN' : 'INFO';
				const msg = `[HTTP] ${evt.method} ${evt.path} ${evt.statusCode} (${evt.latencyMs}ms)`;
				const details = JSON.stringify({
					method: evt.method,
					path: evt.path,
					statusCode: evt.statusCode,
					latencyMs: evt.latencyMs,
					userAgent: evt.userAgent || null,
					riskScore: evt.riskScore || 0,
					requestId: evt.requestId || null,
					...evt.detail,
				});

				valueClauses.push(
					`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`
				);
				params.push(
					evt.timestamp,
					level,
					'http',
					msg,
					details,
					evt.userId ?? null,
					evt.ip || ''
				);
				paramIdx += 7;
			}

			if (valueClauses.length > 0) {
				await pool.query(
					`INSERT INTO system_logs (timestamp, level, service, message, details, user_id, ip)
					 VALUES ${valueClauses.join(', ')}`,
					params
				);
			}

			// Periodic rolling retention prune (every 6 hours, deletes logs older than 30 days)
			const now = Date.now();
			if (now - this.lastPruneTime > 6 * 3600 * 1000) {
				this.lastPruneTime = now;
				const cutoff = now - 30 * 24 * 3600 * 1000;
				void pool.query('DELETE FROM system_logs WHERE timestamp < $1', [cutoff]).catch(() => {});
			}
		} catch (err) {
			// Graceful error logging without disrupting request pipeline
			console.warn('[TelemetryBatchBuffer] Batch flush warning:', (err as Error).message);
		} finally {
			this.isFlushing = false;
			if (this.queue.length > 0 && !this.timer) {
				this.timer = setTimeout(() => {
					this.timer = null;
					void this.flush();
				}, this.flushIntervalMs);
				this.timer.unref?.();
			}
		}
	}
}

// Global singleton instance across warm server restarts
interface TelemetryGlobal {
	__telemetryBatchBuffer?: TelemetryBatchBuffer;
}
const globalTelemetry = globalThis as typeof globalThis & TelemetryGlobal;

export const telemetryBuffer: TelemetryBatchBuffer =
	globalTelemetry.__telemetryBatchBuffer ?? (globalTelemetry.__telemetryBatchBuffer = new TelemetryBatchBuffer());
