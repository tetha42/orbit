import { logSystemEvent } from '../logs.repo';
import { recordSecurityStrike } from '../security.repo';
import { runFimScan } from './fim';

const fimWatcherState = globalThis as { __fimBackgroundWatcher?: boolean };
const fimAlertedFiles = new Set<string>();

/**
 * Periodically monitors sensitive runtime directories (`data/uploads/` and `/tmp/`)
 * for unauthorized webshells or binaries using the Go FIM scanner.
 * Disabled by default to avoid unneeded CPU/disk I/O and logs unless ENABLE_BACKGROUND_FIM=1.
 */
export function scheduleBackgroundFimCheck(intervalMs = 30 * 60_000): void {
	if (fimWatcherState.__fimBackgroundWatcher) return;
	if (process.env.ENABLE_BACKGROUND_FIM !== '1') return;
	fimWatcherState.__fimBackgroundWatcher = true;

	const runCheck = async () => {
		try {
			const targets = ['uploads', 'tmp'];
			for (const target of targets) {
				const result = await runFimScan(target, { force: true });
				const criticalFiles = (result.suspiciousFiles || []).filter(
					(f) => f.severity === 'CRITICAL'
				);
				if (criticalFiles.length > 0) {
					const newCritical = criticalFiles.filter(
						(f) => !fimAlertedFiles.has(`${target}:${f.path}:${f.matchedRule}`)
					);
					for (const file of newCritical) {
						fimAlertedFiles.add(`${target}:${file.path}:${file.matchedRule}`);
						await logSystemEvent({
							service: 'security',
							level: 'CRITICAL',
							message: `🚨 [FIM CRITICAL ALARM] Directory watcher detected suspicious file or webshell (${target}): ${file.path} (${file.matchedRule})`,
							detail: { target, file },
							ip: '127.0.0.1',
						});
					}
					if (newCritical.length > 0) {
						void recordSecurityStrike({
							ip: '127.0.0.1',
							points: 100,
							reason: `FIM CRITICAL: ${newCritical.length} suspicious files/webshells (${target})`,
							path: `/fim/${target}`,
						});
					}
				} else {
					for (const key of Array.from(fimAlertedFiles)) {
						if (key.startsWith(`${target}:`)) {
							fimAlertedFiles.delete(key);
						}
					}
				}
			}
		} catch (err) {
			console.error('[FIM Background Watcher] Scan error:', err);
		}
	};

	setTimeout(runCheck, 10_000).unref?.();
	setInterval(runCheck, intervalMs).unref?.();
}

if (typeof window === 'undefined') {
	scheduleBackgroundFimCheck();
}
