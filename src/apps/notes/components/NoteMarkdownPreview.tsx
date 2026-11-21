'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { openMediaAttachment } from '@/core/mediaViewer';
import { useWindowActions } from '@/core/windows';
import type { NoteColors } from '../types';

interface NoteMarkdownPreviewProps {
	body: string;
	colors: NoteColors;
	onToggleChecklistItem: (index: number) => void;
}

const SAFE_UPLOAD_URL_RE = /^\/api\/uploads\/[a-zA-Z0-9._-]+$/;
const IMAGE_TOKEN_SPLIT_RE = /(!\[[^\]]*\]\([^)]+\))/g;
const IMAGE_SYNTAX_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

function isSafeNoteUploadUrl(url: string): boolean {
	return SAFE_UPLOAD_URL_RE.test(url) && !url.includes('..');
}

export function NoteMarkdownPreview({ body, colors, onToggleChecklistItem }: NoteMarkdownPreviewProps) {
	const { t } = useI18n();
	const { openApp } = useWindowActions();

	const openImageInViewer = (url: string, alt: string) => {
		const filename = url.slice('/api/uploads/'.length);
		if (openMediaAttachment({ name: alt.trim() || filename, url })) {
			openApp('mediaviewer');
		}
	};

	const renderInlineSegments = (text: string, lineKey: number) => {
		const parts = text.split(IMAGE_TOKEN_SPLIT_RE);
		if (parts.length === 1) return text;
		return parts.map((part, partIdx) => {
			const match = IMAGE_SYNTAX_RE.exec(part);
			if (match) {
				const alt = match[1] ?? '';
				const url = match[2]?.trim() ?? '';
				if (isSafeNoteUploadUrl(url)) {
					return (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							key={`${lineKey}-${partIdx}`}
							src={url}
							alt={alt || t('notesImagePreviewAlt')}
							loading="lazy"
							onClick={() => openImageInViewer(url, alt)}
							style={{
								display: 'block',
								maxWidth: '100%',
								maxHeight: '360px',
								objectFit: 'contain',
								borderRadius: '8px',
								margin: '8px 0',
								cursor: 'zoom-in',
								border: `1px solid ${colors.borderSubtle}`,
							}}
						/>
					);
				}
			}
			return part ? <React.Fragment key={`${lineKey}-${partIdx}`}>{part}</React.Fragment> : null;
		});
	};

	return (
		<div style={{ fontSize: '14.5px', lineHeight: 1.65, color: colors.editorText }}>
			{body.split('\n').map((line, idx) => {
				if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) {
					const isChecked = line.trim().startsWith('- [x]');
					const itemText = line.replace(/^- \[(x| )\]/, '').trim();
					return (
						<div key={idx} onClick={() => onToggleChecklistItem(idx)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', cursor: 'pointer' }}>
							<div
								style={{
									width: '18px',
									height: '18px',
									borderRadius: '50%',
									border: isChecked ? 'none' : '1.8px solid var(--accent)',
									background: isChecked ? colors.accentGold : 'transparent',
									display: 'grid',
									placeItems: 'center',
									color: 'var(--accent-contrast, #ffffff)',
									flexShrink: 0,
									transition: 'all 0.15s ease',
								}}
							>
								{isChecked && <Check size={11} strokeWidth={3} />}
							</div>
							<span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.45 : 1 }}>
								{renderInlineSegments(itemText, idx)}
							</span>
						</div>
					);
				}
				if (line.startsWith('# ')) {
					return (
						<h1 key={idx} style={{ fontSize: '18px', fontWeight: 700, margin: '14px 0 6px 0', color: colors.editorTitleText }}>
							{line.replace('# ', '')}
						</h1>
					);
				}
				if (line.startsWith('## ') || line.startsWith('### ')) {
					return (
						<h2 key={idx} style={{ fontSize: '16px', fontWeight: 600, margin: '12px 0 4px 0', color: colors.editorTitleText }}>
							{line.replace(/^###? /, '')}
						</h2>
					);
				}
				if (line.startsWith('- ')) {
					return (
						<li key={idx} style={{ marginLeft: '20px', padding: '2px 0' }}>
							{renderInlineSegments(line.replace('- ', ''), idx)}
						</li>
					);
				}
				if (line.startsWith('|')) {
					return (
						<div
							key={idx}
							style={{
								fontFamily: 'monospace',
								fontSize: '13px',
								padding: '2px 6px',
								background: colors.tableBg,
								borderRadius: '4px',
								margin: '1px 0',
								color: colors.appText,
							}}
						>
							{line}
						</div>
					);
				}
				if (!line.trim()) {
					return <div key={idx} style={{ height: '8px' }} />;
				}
				return <div key={idx} style={{ margin: '3px 0' }}>{renderInlineSegments(line, idx)}</div>;
			})}
		</div>
	);
}
