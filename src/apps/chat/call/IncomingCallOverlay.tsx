'use client';

import React, { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOff, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { CallPeerAudio } from './CallPeerAudio';
import {
	acceptIncomingVoiceCall,
	declineOrHangupVoiceCall,
	dismissCallError,
	handleRealtimeCallEvent,
	toggleVoiceCallMute,
	useVoiceCallState,
} from './callStore';

export function IncomingCallOverlay() {
	const { currentUser } = useSession();
	const { t } = useI18n();
	const callState = useVoiceCallState();
	const [elapsedSec, setElapsedSec] = useState(0);

	useEffect(() => {
		if (!callState.inCall || !callState.startedAt) {
			setElapsedSec(0);
			return;
		}
		const tick = () => {
			setElapsedSec(Math.max(0, Math.floor((Date.now() - (callState.startedAt || Date.now())) / 1000)));
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [callState.inCall, callState.startedAt]);

	useEffect(() => {
		if (!currentUser?.id) return;
		const onStreamEvent = (ev: Event) => {
			const detail = (ev as CustomEvent<Record<string, unknown>>).detail;
			if (detail) handleRealtimeCallEvent(detail, currentUser.id);
		};
		window.addEventListener('orbit:realtime-event', onStreamEvent);
		return () => window.removeEventListener('orbit:realtime-event', onStreamEvent);
	}, [currentUser?.id]);

	if (!currentUser) return null;

	if (callState.errorKey) {
		return (
			<div
				style={{
					position: 'fixed',
					top: '48px',
					right: '16px',
					zIndex: 9999,
					background: 'var(--window-bg)',
					border: '1px solid var(--border-subtle)',
					borderRadius: '12px',
					padding: '10px 14px',
					display: 'flex',
					alignItems: 'center',
					gap: '10px',
					color: 'var(--text-primary)',
					boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
				}}
			>
				<span style={{ fontSize: '12px' }}>{t(callState.errorKey)}</span>
				<button
					type="button"
					onClick={dismissCallError}
					aria-label={t('chatCallDismiss')}
					style={{
						background: 'transparent',
						border: 'none',
						color: 'var(--text-secondary)',
						cursor: 'pointer',
					}}
				>
					<X size={14} />
				</button>
			</div>
		);
	}

	if (callState.incomingRing && !callState.inCall) {
		return (
			<div
				style={{
					position: 'fixed',
					top: '48px',
					right: '16px',
					zIndex: 9999,
					background: 'var(--window-bg)',
					border: '1px solid var(--accent-border)',
					borderRadius: '14px',
					padding: '14px 16px',
					minWidth: '280px',
					color: 'var(--text-primary)',
					boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
					display: 'flex',
					flexDirection: 'column',
					gap: '12px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					<div
						style={{
							width: '36px',
							height: '36px',
							borderRadius: '50%',
							background: 'var(--accent-subtle)',
							color: 'var(--accent)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<PhoneIncoming size={18} />
					</div>
					<div style={{ minWidth: 0, flex: 1 }}>
						<div style={{ fontSize: '13px', fontWeight: 700 }}>{callState.incomingRing.fromName}</div>
						<div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('chatCallIncoming')}</div>
					</div>
				</div>
				<div style={{ display: 'flex', gap: '8px' }}>
					<button
						type="button"
						onClick={() => void acceptIncomingVoiceCall(callState.incomingRing!.callId, currentUser.id)}
						style={{
							flex: 1,
							padding: '7px 12px',
							borderRadius: '8px',
							border: 'none',
							background: 'var(--accent)',
							color: 'var(--text-on-accent)',
							fontWeight: 600,
							fontSize: '12px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '6px',
						}}
					>
						<Phone size={14} />
						{t('chatCallAccept')}
					</button>
					<button
						type="button"
						onClick={() => void declineOrHangupVoiceCall(callState.incomingRing!.callId)}
						style={{
							flex: 1,
							padding: '7px 12px',
							borderRadius: '8px',
							border: '1px solid var(--border-subtle)',
							background: 'var(--surface-hover)',
							color: 'var(--text-primary)',
							fontWeight: 600,
							fontSize: '12px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '6px',
						}}
					>
						<PhoneOff size={14} />
						{t('chatCallDecline')}
					</button>
				</div>
			</div>
		);
	}

	if (!callState.inCall || !callState.call) return null;

	return (
		<CallPeerAudio
			call={callState.call}
			elapsedSec={elapsedSec}
			muted={callState.muted}
			onToggleMute={toggleVoiceCallMute}
			onHangup={() => void declineOrHangupVoiceCall()}
		/>
	);
}
