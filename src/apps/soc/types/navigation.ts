import type { TestbenchTab } from '../testbench/types';
export type { TestbenchTab };

/** Defence tabs plus the test-lab tabs hosted in the same studio. */
export type SocTab = 'radar' | 'firewall' | 'sessions' | 'siem' | 'inspection' | 'audit' | TestbenchTab;

export const isLabTab = (tab: SocTab): tab is TestbenchTab =>
	tab === 'oauth' || tab === 'api' || tab === 'fuzzer' || tab === 'health' || tab === 'session';

/** Lab tabs a SoC user without management rights may open; the rest need SoC "manage" permission. */
export const SOC_LAB_TABS: TestbenchTab[] = ['api', 'session'];

export const LAB_SEGMENTS: Array<{ id: TestbenchTab; key: string }> = [
	{ id: 'oauth', key: 'tbTabOAuthShort' },
	{ id: 'api', key: 'tbTabApiShort' },
	{ id: 'fuzzer', key: 'tbTabFuzzerShort' },
	{ id: 'health', key: 'tbTabHealthShort' },
	{ id: 'session', key: 'tbTabSessionShort' },
];

const LOCALE_BY_LANG = {
	en: 'en-GB',
	tr: 'tr-TR',
} as const;

export function formatDateTime(ts: number | null | undefined, lang: 'tr' | 'en'): string {
	if (!ts) return '—';
	try {
		return new Date(ts).toLocaleString(LOCALE_BY_LANG[lang] ?? 'en-GB', {
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	} catch {
		return '—';
	}
}

export function summarizeUa(ua: string | null | undefined): string {
	if (!ua) return '—';
	if (ua.length <= 48) return ua;
	return `${ua.slice(0, 45)}…`;
}
