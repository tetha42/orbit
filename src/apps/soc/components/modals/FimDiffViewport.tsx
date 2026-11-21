'use client';

import React from 'react';
import type { MODALS_I18N } from './i18nModals';
import styles from './SocModals.module.css';

export interface FimDiffData {
	path: string;
	status: 'modified' | 'added' | 'deleted' | 'unchanged' | 'not_found';
	originalContent: string;
	currentContent: string;
	diff: string;
	error?: string;
}

type ModalsCopy = (typeof MODALS_I18N)['en'] | (typeof MODALS_I18N)['tr'];

interface FimDiffViewportProps {
	loading: boolean;
	data: FimDiffData | null;
	viewMode: 'split' | 'unified';
	copy: ModalsCopy;
}

function DiffLines({ content, emptyText }: { content: string; emptyText: string }) {
	if (!content) {
		return (
			<div style={{ padding: '16px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
				{emptyText}
			</div>
		);
	}
	return (
		<>
			{content.split('\n').map((line, idx) => (
				<div key={idx} className={styles.diffLine}>
					<span className={styles.diffLineNumber}>{idx + 1}</span>
					<span>{line || ' '}</span>
				</div>
			))}
		</>
	);
}

function UnifiedDiffLines({ diff, noHunksText }: { diff?: string; noHunksText: string }) {
	if (!diff) {
		return (
			<div style={{ padding: '16px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
				{noHunksText}
			</div>
		);
	}
	return (
		<>
			{diff.split('\n').map((line, idx) => {
				let lineClass = styles.diffLine;
				if (line.startsWith('+') && !line.startsWith('+++')) {
					lineClass = `${styles.diffLine} ${styles.diffLineAdd}`;
				} else if (line.startsWith('-') && !line.startsWith('---')) {
					lineClass = `${styles.diffLine} ${styles.diffLineDel}`;
				}
				return (
					<div key={idx} className={lineClass}>
						<span className={styles.diffLineNumber}>{idx + 1}</span>
						<span>{line || ' '}</span>
					</div>
				);
			})}
		</>
	);
}

export function FimDiffViewport({ loading, data, viewMode, copy }: FimDiffViewportProps) {
	if (loading) {
		return (
			<div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
				<span>{copy.fimDiffLoading}</span>
			</div>
		);
	}

	if (data?.error) {
		return (
			<div
				style={{
					padding: '16px',
					background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
					color: 'var(--danger)',
					borderRadius: '8px',
					fontSize: '12px',
				}}
			>
				{data.error}
			</div>
		);
	}

	if (viewMode === 'split') {
		return (
			<div className={styles.diffPanes}>
				<div className={styles.diffPane}>
					<div className={styles.diffPaneHeader}>
						<span>{copy.fimDiffBaselineHeader}</span>
					</div>
					<div className={styles.diffCodeContainer}>
						<DiffLines content={data?.originalContent || ''} emptyText={copy.fimDiffNoBaseline} />
					</div>
				</div>
				<div className={styles.diffPane}>
					<div className={styles.diffPaneHeader}>
						<span>{copy.fimDiffCurrentHeader}</span>
					</div>
					<div className={styles.diffCodeContainer}>
						<DiffLines content={data?.currentContent || ''} emptyText={copy.fimDiffFileDeleted} />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.diffPane} style={{ flex: 1, minHeight: 0 }}>
			<div className={styles.diffPaneHeader}>
				<span>{copy.fimDiffUnifiedHeader}</span>
			</div>
			<div className={styles.diffCodeContainer}>
				<UnifiedDiffLines diff={data?.diff} noHunksText={copy.fimDiffNoHunks} />
			</div>
		</div>
	);
}
