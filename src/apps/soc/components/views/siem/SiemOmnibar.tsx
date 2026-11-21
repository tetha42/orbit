'use client';

import React from 'react';
import { Filter, FileSearch, X } from 'lucide-react';
import type { SiemSearchField, SiemSearchOp, SiemFilterSnapshot } from '../../../types';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../SocSiem.module.css';

interface SiemOmnibarProps {
	siemSearchField: SiemSearchField;
	setSiemSearchField: (val: SiemSearchField) => void;
	siemSearchOp: SiemSearchOp;
	setSiemSearchOp: (val: SiemSearchOp) => void;
	siemSearch: string;
	setSiemSearch: (val: string) => void;
	isLoading: boolean;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onFetch: (overrides?: Partial<SiemFilterSnapshot>) => Promise<void>;
}

const KQL_CHIPS = [
	{ label: 'service:auth', val: 'service:auth ' },
	{ label: 'level:WARN', val: 'level:WARN ' },
	{ label: 'level:CRITICAL', val: 'level:CRITICAL ' },
	{ label: 'ip:!127.0.0.1', val: 'ip:!127.0.0.1 ' },
	{ label: 'msg:failed', val: 'msg:failed ' },
];

export function SiemOmnibar({
	siemSearchField,
	setSiemSearchField,
	siemSearchOp,
	setSiemSearchOp,
	siemSearch,
	setSiemSearch,
	isLoading,
	copy,
	onFetch,
}: SiemOmnibarProps) {
	return (
		<>
			<div className={s.siemOmnibar}>
				<div className={s.siemOmnibarScope} title={copy.searchScopeTitle}>
					<Filter size={12} style={{ color: 'var(--text-secondary)' }} />
					<select
						className={s.siemScopeSelect}
						value={siemSearchField}
						onChange={(e) => {
							const next = e.target.value as SiemSearchField;
							setSiemSearchField(next);
							if (siemSearch.trim()) void onFetch({ searchField: next });
						}}
					>
						<option value="all">{copy.colAll}</option>
						<option value="message">{copy.colMessage}</option>
						<option value="ip">IP</option>
						<option value="service">{copy.colService}</option>
						<option value="userId">{copy.colActor}</option>
						<option value="detail">{copy.colJsonDetail}</option>
					</select>
				</div>

				<div className={s.siemOmnibarScope} title={copy.matchConditionTitle}>
					<select
						className={s.siemScopeSelect}
						value={siemSearchOp}
						onChange={(e) => {
							const next = e.target.value as SiemSearchOp;
							setSiemSearchOp(next);
							if (siemSearch.trim()) void onFetch({ searchOp: next });
						}}
					>
						<option value="contains">{copy.opContains}</option>
						<option value="not_contains">{copy.opNotContains}</option>
						<option value="equals">{copy.opEquals}</option>
						<option value="not_equals">{copy.opNotEquals}</option>
						<option value="starts_with">{copy.opStartsWith}</option>
						<option value="ends_with">{copy.opEndsWith}</option>
					</select>
				</div>

				<div className={s.siemInputWrap}>
					<input
						type="text"
						className={s.siemSearchInput}
						placeholder={copy.searchPlaceholder}
						value={siemSearch}
						onChange={(e) => setSiemSearch(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') void onFetch();
						}}
					/>
					{siemSearch && (
						<button
							type="button"
							className={s.siemOmnibarClear}
							onClick={() => {
								setSiemSearch('');
								void onFetch({ search: '' });
							}}
							title={copy.clearSearchTitle}
						>
							<X size={13} />
						</button>
					)}
				</div>

				<button
					type="button"
					className={s.siemSubmitBtn}
					onClick={() => void onFetch()}
					disabled={isLoading}
				>
					<FileSearch size={13} />
					<span>{copy.filterBtn}</span>
				</button>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '4px 0 10px', fontSize: 11 }}>
				<span style={{ color: 'var(--text-tertiary, #8e8e93)', fontWeight: 600, fontSize: 10 }}>KQL:</span>
				{KQL_CHIPS.map((pill) => (
					<button
						key={pill.label}
						type="button"
						onClick={() => {
							const next = `${siemSearch ? `${siemSearch.trim()} ` : ''}${pill.val}`;
							setSiemSearch(next);
						}}
						style={{
							background: 'var(--fill-soft, rgba(0,0,0,0.04))',
							border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
							borderRadius: 4,
							padding: '2px 7px',
							fontSize: 10.5,
							fontFamily: 'monospace',
							cursor: 'pointer',
							color: 'var(--text-secondary)',
						}}
					>
						+{pill.label}
					</button>
				))}
				{siemSearch.includes(':') && (
					<span
						style={{
							fontSize: 10,
							fontWeight: 700,
							padding: '2px 6px',
							borderRadius: 4,
							background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
							color: 'var(--accent)',
							marginLeft: 'auto',
						}}
					>
						KQL SYNTAX ACTIVE
					</span>
				)}
			</div>
		</>
	);
}
