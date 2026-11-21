'use client';

import React from 'react';
import { Copy, FileSignature, Lock, Pencil, Printer, ShieldCheck, Trash2, Unlock } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import { documentRef, VERIFICATION_PREFIX } from './documentMeta';
import type { Decision } from './types';

interface DecisionDetailProps {
	decision: Decision;
	canManage: boolean;
	isAdmin: boolean;
	formatDate: (value: number) => string;
	onEdit: () => void;
	onLock: () => void;
	onUnlock: () => void;
	onDelete: () => void;
	onCopy: () => void;
	onPrint: () => void;
	onPetition: () => void;
}

const actionStyle: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 5,
	fontSize: 12,
	fontWeight: 650,
	borderRadius: 7,
	padding: '6px 11px',
	cursor: 'pointer',
	border: '1px solid var(--window-border)',
	background: 'transparent',
	color: 'inherit',
};

/** One official document: its printed content, its digest and the actions the caller may take. */
export function DecisionDetail({
	decision,
	canManage,
	isAdmin,
	formatDate,
	onEdit,
	onLock,
	onUnlock,
	onDelete,
	onCopy,
	onPrint,
	onPetition,
}: DecisionDetailProps) {
	const { t } = useI18n();
	const locked = Number(decision.isLocked) === 1;
	const no = documentRef(decision.referenceNumber);

	return (
		<div data-decision-detail style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflowY: 'auto' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
				<div style={{ flex: 1, minWidth: 200 }}>
					<div style={{ fontSize: 11, opacity: 0.6, fontFamily: 'var(--font-mono, monospace)' }}>
						{t('decisionsDocNo')} {no}
					</div>
					<h2 style={{ margin: '4px 0 0', fontSize: 17, lineHeight: 1.3 }}>{decision.title}</h2>
				</div>
				{locked && (
					<span
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 5,
							fontSize: 11,
							fontWeight: 700,
							color: 'var(--warning)',
							border: '1px solid color-mix(in srgb, var(--warning) 45%, transparent)',
							background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
							borderRadius: 6,
							padding: '3px 8px',
						}}
					>
						<Lock size={12} /> {t('decisionsLocked')}
					</span>
				)}
			</div>

			<div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: 11.5, opacity: 0.7 }}>
				<span>
					{t('decisionsDateLabel')} {formatDate(decision.date)}
				</span>
				{decision.creatorName && (
					<span>
						{t('decisionsCreatedBy')} {decision.creatorName}
					</span>
				)}
				<span>
					{Number(decision.isPublic) === 1 ? t('decisionsPublic') : t('decisionsPrivate')}
				</span>
			</div>

			<div
				style={{
					border: '1px solid var(--window-border)',
					borderRadius: 10,
					padding: '14px 16px',
					background: 'rgba(255,255,255,0.025)',
					display: 'flex',
					flexDirection: 'column',
					gap: 10,
					fontSize: 12.5,
					lineHeight: 1.55,
				}}
			>
				{decision.agenda && (
					<div>
						<div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.6 }}>
							{t('decisionsAgendaHeader')}
						</div>
						<div style={{ whiteSpace: 'pre-wrap' }}>{decision.agenda}</div>
					</div>
				)}
				<div>
					<div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.6 }}>{t('decisionsSubject')}</div>
					<div style={{ whiteSpace: 'pre-wrap' }}>{decision.content}</div>
				</div>
			</div>

			<div
				style={{
					display: 'flex',
					gap: '10px',
					flexWrap: 'wrap',
					fontSize: 11,
					padding: '10px 12px',
					borderRadius: 9,
					border: '1px dashed var(--window-border)',
					background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
					<ShieldCheck size={13} /> {t('decisionsSecurityVerification')}
				</div>
				<div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', opacity: 0.8 }}>
					<span>
						{t('decisionsVerifyCode')} {VERIFICATION_PREFIX}
						{decision.referenceNumber}
					</span>
					{decision.summary && (
						<span>
							{t('decisionsSummaryLabel')} {decision.summary}
						</span>
					)}
				</div>
			</div>

			<div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
				{canManage && !locked && (
					<>
						<button type="button" className={ui.btn} style={actionStyle} onClick={onEdit}>
							<Pencil size={13} /> {t('edit')}
						</button>
						<button type="button" className={ui.primaryBtn} style={actionStyle} onClick={onLock}>
							<Lock size={13} /> {t('decisionsLockBtn')}
						</button>
						<button type="button" className={ui.btn} style={actionStyle} onClick={onDelete}>
							<Trash2 size={13} /> {t('delete')}
						</button>
					</>
				)}
				{canManage && locked && isAdmin && (
					<button type="button" className={ui.btn} style={actionStyle} onClick={onUnlock}>
						<Unlock size={13} /> {t('decisionsUnlockBtn')}
					</button>
				)}
				{locked && (
					<button type="button" className={ui.btn} style={actionStyle} onClick={onPetition}>
						<FileSignature size={13} /> {t('decisionsGetPetition')}
					</button>
				)}
				<button type="button" className={ui.btn} style={actionStyle} onClick={onCopy}>
					<Copy size={13} /> {t('decisionsCopyText')}
				</button>
				<button type="button" className={ui.btn} style={actionStyle} onClick={onPrint}>
					<Printer size={13} /> {t('decisionsPrintBtn')}
				</button>
			</div>
		</div>
	);
}
