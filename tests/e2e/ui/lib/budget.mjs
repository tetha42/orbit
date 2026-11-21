// Process-tree RSS memory and wall-clock budget watchdog for E2E runs.
//
// Samples `/proc/<pid>/status` across all tracked root PIDs (runner, Chromium, Next.js servers)
// and aborts immediately if total resident memory or elapsed wall-clock exceeds strict limits.
import fs from 'node:fs';

function readProcTable() {
	const children = new Map();
	const rssKb = new Map();
	let entries = [];
	try {
		entries = fs.readdirSync('/proc');
	} catch {
		return { children, rssKb };
	}

	for (const entry of entries) {
		if (!/^\d+$/.test(entry)) continue;
		const pid = Number(entry);
		try {
			const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
			const ppidMatch = /^PPid:\s+(\d+)/m.exec(status);
			const rssMatch = /^VmRSS:\s+(\d+)\s+kB/m.exec(status);
			const ppid = ppidMatch ? Number(ppidMatch[1]) : 0;
			const kb = rssMatch ? Number(rssMatch[1]) : 0;
			rssKb.set(pid, kb);
			if (!children.has(ppid)) children.set(ppid, []);
			children.get(ppid).push(pid);
		} catch {
			// Process exited between readdirSync and readFileSync.
		}
	}
	return { children, rssKb };
}

function readPhysicalKb(pid, fallbackKb) {
	try {
		const rollup = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
		const pssMatch = /^Pss:\s+(\d+)\s+kB/m.exec(rollup);
		if (pssMatch) return Number(pssMatch[1]);
	} catch {
		// Fall back to VmRSS if smaps_rollup is unavailable or exited.
	}
	return fallbackKb;
}

function collectSubtree(rootPid, children, excludeRoots, seen) {
	const stack = [rootPid];
	const pids = [];
	while (stack.length > 0) {
		const pid = stack.pop();
		if (!pid || seen.has(pid)) continue;
		seen.add(pid);
		pids.push(pid);
		for (const child of children.get(pid) ?? []) {
			if (!excludeRoots.has(child)) stack.push(child);
		}
	}
	return pids;
}

/** Creates a live memory and runtime watchdog capped at `maxRssMb` and `maxDurationSec`. */
export function createBudgetMonitor({
	maxRssMb = Number(process.env.E2E_MAX_RSS_MB || 1024),
	maxDurationSec = Number(process.env.E2E_MAX_DURATION_SEC || 180),
	onViolation,
} = {}) {
	const startedAt = Date.now();
	const tracked = new Map(); // pid -> label
	let peakRssMb = 0;
	let peakBreakdown = {};
	let consecutiveRssBreaches = 0;
	let violationReason = '';
	let triggering = false;

	const sample = () => {
		const { children, rssKb } = readProcTable();
		// Prune exited tracked roots automatically so stale PIDs are never reused for accounting.
		for (const pid of tracked.keys()) {
			if (!rssKb.has(pid)) tracked.delete(pid);
		}

		// Collect child servers/browsers before the runner itself so subtrees are attributed specifically.
		const roots = [...tracked.entries()].sort((a, b) => (a[0] === process.pid ? 1 : b[0] === process.pid ? -1 : 0));
		const excludeRoots = new Set(tracked.keys());
		const seen = new Set();
		const breakdown = {};
		let totalKb = 0;

		for (const [pid, label] of roots) {
			excludeRoots.delete(pid);
			const subtree = collectSubtree(pid, children, excludeRoots, seen);
			let labelKb = 0;
			for (const member of subtree) labelKb += readPhysicalKb(member, rssKb.get(member) ?? 0);
			totalKb += labelKb;
			breakdown[label] = (breakdown[label] ?? 0) + Math.round(labelKb / 1024);
			excludeRoots.add(pid);
		}

		const totalRssMb = Math.round(totalKb / 1024);
		const elapsedSec = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
		if (totalRssMb > peakRssMb) {
			peakRssMb = totalRssMb;
			peakBreakdown = breakdown;
		}
		return { totalRssMb, elapsedSec, breakdown };
	};

	const tick = () => {
		if (violationReason || triggering) return;
		const snap = sample();
		consecutiveRssBreaches = snap.totalRssMb > maxRssMb ? consecutiveRssBreaches + 1 : 0;

		if (snap.totalRssMb > maxRssMb * 1.1 || consecutiveRssBreaches >= 2) {
			violationReason = `RAM budget exceeded: ${snap.totalRssMb} MB > ${maxRssMb} MB (${JSON.stringify(snap.breakdown)})`;
		} else if (snap.elapsedSec > maxDurationSec) {
			violationReason = `Time budget exceeded: ${snap.elapsedSec}s > ${maxDurationSec}s`;
		}

		if (violationReason && onViolation) {
			triggering = true;
			Promise.resolve(onViolation(violationReason, snap)).catch(() => {});
		}
	};

	const timer = setInterval(tick, 1000);
	timer.unref();

	return {
		track(label, pid) {
			if (Number.isInteger(pid) && pid > 0) tracked.set(pid, label);
		},
		untrack(pid) {
			if (pid) tracked.delete(pid);
		},
		sample,
		stop() {
			clearInterval(timer);
		},
		summary() {
			const snap = sample();
			return {
				peakRssMb: Math.max(peakRssMb, snap.totalRssMb),
				lastRssMb: snap.totalRssMb,
				elapsedSec: snap.elapsedSec,
				maxRssMb,
				maxDurationSec,
				peakBreakdown,
				violationReason,
			};
		},
	};
}
