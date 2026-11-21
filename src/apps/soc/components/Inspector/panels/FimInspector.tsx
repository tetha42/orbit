'use client';

import React from 'react';
import type { InspectorFimData } from '../../../types';
import type { INSPECTOR_I18N } from '../i18nInspector';
import s from '../SocInspector.module.css';

interface FimInspectorProps {
	fim: InspectorFimData;
	fimDiff: string | null;
	fimLoading: boolean;
	copy: (typeof INSPECTOR_I18N)['en'] | (typeof INSPECTOR_I18N)['tr'];
}

export function FimInspector({ fim, fimDiff, fimLoading, copy }: FimInspectorProps) {
	return (
		<>
			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.fimProfile}</span>
					<span className={`${s.badge} ${fim.match ? s.badgeDanger : s.badgeWarn}`}>
						{fim.match ? copy.fimSuspicious : copy.fimTampered}
					</span>
				</div>
				<div className={s.gridProps}>
					<span className={s.propLabel}>{copy.fimTargetFile}</span>
					<span className={`${s.propValue} ${s.mono}`} style={{ wordBreak: 'break-all' }}>
						{fim.file}
					</span>

					{fim.sha256 && (
						<>
							<span className={s.propLabel}>SHA-256</span>
							<span className={`${s.propValue} ${s.mono}`}>{fim.sha256.slice(0, 16)}…</span>
						</>
					)}

					{fim.match && (
						<>
							<span className={s.propLabel}>{copy.fimMatchedRule}</span>
							<span className={`${s.propValue} ${s.badge} ${s.badgeDanger}`}>
								{fim.match.matchedRule} (L#{fim.match.line})
							</span>
						</>
					)}
				</div>
			</div>

			{fimLoading ? (
				<div className={s.sectionCard}>
					<div style={{ fontSize: 12, opacity: 0.7, padding: '12px 0' }}>
						{copy.fimAnalyzingDiff}
					</div>
				</div>
			) : fim.diff || fimDiff ? (
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{copy.fimGitDiff}</span>
					</div>
					<pre className={s.codeViewer}>{fim.diff || fimDiff}</pre>
				</div>
			) : null}

			{fim.match?.snippet && (
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{copy.fimSnippet}</span>
					</div>
					<pre className={s.codeViewer}>{fim.match.snippet}</pre>
				</div>
			)}
		</>
	);
}
