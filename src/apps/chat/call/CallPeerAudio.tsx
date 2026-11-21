'use client';

import React from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatCallRecord } from '@/domains/webrtc/types';
import { fill } from '@/lib/text';

interface CallPeerAudioProps {
	call: ChatCallRecord;
	elapsedSec: number;
	muted: boolean;
	onToggleMute: () => void;
	onHangup: () => void;
}

export function CallPeerAudio({
	call,
	elapsedSec,
	muted,
	onToggleMute,
	onHangup,
}: CallPeerAudioProps) {
	const { t } = useI18n();
	const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
	const secs = String(elapsedSec % 60).padStart(2, '0');
	const count = call.participants.length;

	return (
		<div
			style={{
				position: 'fixed',
				top: '44px',
				right: '16px',
				zIndex: 9998,
				background: 'var(--window-bg)',
				border: '1px solid var(--accent-border)',
				borderRadius: '999px',
				padding: '6px 12px',
				display: 'flex',
				alignItems: 'center',
				gap: '10px',
				color: 'var(--text-primary)',
				boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
			}}
		>
			<Phone size={14} color="var(--accent)" />
			<span style={{ fontSize: '12px', fontWeight: 600 }}>
				{call.status === 'ringing' ? t('chatCallOutgoing') : `${mins}:${secs}`}
			</span>
			<span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
				{fill(t('chatCallParticipantsCount'), { n: count })}
			</span>
			<button
				type="button"
				onClick={onToggleMute}
				title={muted ? t('chatCallUnmute') : t('chatCallMute')}
				style={{
					background: 'var(--surface-hover)',
					border: '1px solid var(--border-subtle)',
					borderRadius: '50%',
					width: '28px',
					height: '28px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'var(--text-primary)',
					cursor: 'pointer',
				}}
			>
				{muted ? <MicOff size={14} /> : <Mic size={14} />}
			</button>
			<button
				type="button"
				onClick={onHangup}
				title={t('chatCallHangup')}
				style={{
					background: 'var(--accent)',
					border: 'none',
					borderRadius: '50%',
					width: '28px',
					height: '28px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'var(--text-on-accent)',
					cursor: 'pointer',
				}}
			>
				<PhoneOff size={14} />
			</button>
		</div>
	);
}
