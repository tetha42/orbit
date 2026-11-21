import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { parseIpCandidate } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

const execFileAsync = promisify(execFile);

const IP_BIN = existsSync('/usr/bin/ip') ? '/usr/bin/ip' : existsSync('/sbin/ip') ? '/sbin/ip' : 'ip';

function validateIpOrCidr(target: string): string | null {
	if (!target) return null;
	const candidate = target.trim();
	if (candidate.includes('/')) {
		const parts = candidate.split('/');
		if (parts.length === 2) {
			const subnet = parseIpCandidate(parts[0]);
			const prefixStr = parts[1].trim();
			if (subnet && /^\d+$/.test(prefixStr)) {
				const prefix = parseInt(prefixStr, 10);
				const isV6 = subnet.includes(':');
				const maxPrefix = isV6 ? 128 : 32;
				if (prefix >= 8 && prefix <= maxPrefix) {
					return `${subnet}/${prefix}`;
				}
			}
		}
		return null;
	}
	return parseIpCandidate(candidate);
}

function isLoopbackOrLocal(ipOrCidr: string): boolean {
	const ip = (ipOrCidr.includes('/') ? ipOrCidr.split('/')[0] : ipOrCidr).toLowerCase().trim();
	return (
		ip === '127.0.0.1' ||
		ip === '::1' ||
		ip === 'localhost' ||
		ip.startsWith('127.') ||
		ip === '0.0.0.0' ||
		ip === '::'
	);
}

export interface KernelFirewallResult {
	success: boolean;
	applied: boolean;
	error?: string;
}

/**
 * Drops packets at Linux Kernel L3/L4 using `/usr/bin/ip route add blackhole <ipOrCidr>`.
 * Falls back gracefully without throwing if non-root permissions (EPERM) or non-Linux OS.
 */
export async function addKernelBlackhole(ipOrCidr: string): Promise<KernelFirewallResult> {
	if (process.platform !== 'linux') {
		return { success: true, applied: false };
	}

	const validTarget = validateIpOrCidr(ipOrCidr);
	if (!validTarget || isLoopbackOrLocal(validTarget)) {
		return { success: false, applied: false, error: 'Invalid or protected local IP' };
	}

	try {
		await execFileAsync(IP_BIN, ['route', 'add', 'blackhole', validTarget]);
		await logSystemEvent({
			service: 'security',
			level: 'INFO',
			message: `🐧 [KERNEL BLACKHOLE] ${validTarget} address added to the Linux kernel (blackhole).`,
			detail: { ip: validTarget, action: 'add_blackhole' },
		});
		return { success: true, applied: true };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		// Route already exists in kernel
		if (msg.includes('File exists') || msg.includes('RTNETLINK answers: File exists')) {
			return { success: true, applied: true };
		}

		// Fallback for non-root containers or lack of CAP_NET_ADMIN
		if (msg.includes('Operation not permitted') || msg.includes('EPERM')) {
			await logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `🐧 [KERNEL BLACKHOLE FALLBACK] No Linux kernel routing permission for ${validTarget} (CAP_NET_ADMIN / root required); application-layer shield is active.`,
				detail: { ip: validTarget, reason: 'EPERM' },
			}).catch(() => {});
			return {
				success: true,
				applied: false,
				error: 'Linux kernel permission (CAP_NET_ADMIN / root) is not available; application-layer shield is active.',
			};
		}

		if (msg.includes('ENOENT') || msg.includes('not found')) {
			return {
				success: true,
				applied: false,
				error: 'The Linux ip tool was not found on the system; application-layer shield is active.',
			};
		}

		return { success: false, applied: false, error: msg };
	}
}

/**
 * Removes a blackhole route from the Linux Kernel routing table using `/usr/bin/ip route del blackhole <ipOrCidr>`.
 */
export async function removeKernelBlackhole(ipOrCidr: string): Promise<KernelFirewallResult> {
	if (process.platform !== 'linux') {
		return { success: true, applied: false };
	}

	const validTarget = validateIpOrCidr(ipOrCidr);
	if (!validTarget || isLoopbackOrLocal(validTarget)) {
		return { success: false, applied: false, error: 'Invalid or protected local IP' };
	}

	try {
		await execFileAsync(IP_BIN, ['route', 'del', 'blackhole', validTarget]);
		await logSystemEvent({
			service: 'security',
			level: 'INFO',
			message: `🐧 [KERNEL BLACKHOLE] ${validTarget} address removed from the Linux kernel routing table.`,
			detail: { ip: validTarget, action: 'del_blackhole' },
		});
		return { success: true, applied: true };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		// Route not present in kernel
		if (msg.includes('No such process') || msg.includes('RTNETLINK answers: No such process')) {
			return { success: true, applied: true };
		}

		if (msg.includes('Operation not permitted') || msg.includes('EPERM')) {
			await logSystemEvent({
				service: 'security',
				level: 'INFO',
				message: `🐧 [KERNEL BLACKHOLE] No operation permission in the kernel table for ${validTarget} (CAP_NET_ADMIN / root), skipping.`,
				detail: { ip: validTarget, reason: 'EPERM' },
			}).catch(() => {});
			return {
				success: true,
				applied: false,
				error: 'Linux kernel permission (CAP_NET_ADMIN / root) is not available.',
			};
		}

		if (msg.includes('ENOENT') || msg.includes('not found')) {
			return {
				success: true,
				applied: false,
				error: 'The Linux ip tool was not found on the system.',
			};
		}

		return { success: false, applied: false, error: msg };
	}
}
