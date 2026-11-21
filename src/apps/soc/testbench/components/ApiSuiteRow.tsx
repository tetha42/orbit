'use client';

import React from 'react';
import { CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { useI18n, resolveLocalizedText } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from './Testbench.module.css';
import type { ApiTestItem } from '../types';

export function ApiSuiteRow({
	item,
	expanded,
	onToggle,
}: {
	item: ApiTestItem;
	expanded: boolean;
	onToggle: () => void;
}) {
	const { t, language } = useI18n();
	const statusClass =
		item.status && item.status >= 200 && item.status < 300
			? s.badgeOk
			: item.status === 403
				? s.badgeWarn
				: s.badgeFail;

	return (
		<React.Fragment>
			<tr style={{ cursor: 'pointer' }} onClick={onToggle}>
				<td style={{ fontWeight: 600 }}>
					{resolveLocalizedText({ tr: item.name, en: item.nameEn }, language)}
				</td>
				<td>
					<code
						style={{ fontSize: '11px', opacity: 0.85, cursor: 'text', userSelect: 'text' }}
						onDoubleClick={(e) => {
							e.stopPropagation();
							const selection = window.getSelection();
							if (!selection) return;
							const range = document.createRange();
							range.selectNodeContents(e.currentTarget);
							selection.removeAllRanges();
							selection.addRange(range);
						}}
					>
						{item.endpoint}
					</code>
				</td>
				<td>
					<span
						style={{
							fontSize: '11px',
							padding: '2px 7px',
							borderRadius: 5,
							background:
								item.requiredLevel === 'admin'
									? 'color-mix(in srgb, var(--danger) 12%, transparent)'
									: 'color-mix(in srgb, var(--accent) 12%, transparent)',
							color: item.requiredLevel === 'admin' ? 'var(--danger)' : 'var(--accent)',
							fontWeight: 600,
						}}
					>
						{item.requiredLevel}
					</span>
				</td>
				<td>
					<span className={`${s.badge} ${statusClass}`}>
						{item.status} {item.statusText}
					</span>
				</td>
				<td>
					<span style={{ fontSize: '11px', opacity: 0.65 }}>
						{fill(t('tbApiExpectedRoleBased'), { code: item.expectedStatus })}
					</span>
				</td>
				<td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>
					{item.latencyMs} ms
				</td>
				<td style={{ textAlign: 'center' }}>
					{item.pass ? (
						<span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '11.5px', fontWeight: 700 }}>
							<CheckCircle2 size={14} /> {t('tbApiPass')}
						</span>
					) : (
						<span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '11.5px', fontWeight: 700 }}>
							<XCircle size={14} /> {t('tbApiFail')}
						</span>
					)}
				</td>
			</tr>
			{expanded && (
				<tr>
					<td colSpan={7} style={{ background: 'var(--fill-softer, rgba(0, 0, 0, 0.04))', padding: '12px 16px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
							<span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500 }}>
								{t('tbApiResponseSnippet')}
							</span>
							<a
								href={item.endpoint}
								target="_blank"
								rel="noreferrer noopener"
								style={{
									fontSize: '11.5px',
									color: 'var(--accent)',
									display: 'inline-flex',
									alignItems: 'center',
									gap: 3,
									textDecoration: 'none',
								}}
							>
								{t('tbApiOpenInBrowser')} <ArrowUpRight size={12} />
							</a>
						</div>
						<div className={s.codeBlock} style={{ maxHeight: 95 }}>
							{item.responseSnippet || t('tbApiNoBody')}
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	);
}
