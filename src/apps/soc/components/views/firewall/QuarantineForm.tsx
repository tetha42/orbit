'use client';

import React from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';
import { fill } from '@/lib/text';
import type { FirewallCopy } from './i18nFirewall';
import s from '../../../Soc.module.css';

interface QuarantineFormProps {
	callerIp: string | null;
	fwIp: string;
	setFwIp: (ip: string) => void;
	fwMode: 'ban' | 'whitelist';
	setFwMode: (mode: 'ban' | 'whitelist') => void;
	fwDuration: string;
	setFwDuration: (duration: string) => void;
	fwReason: string;
	setFwReason: (reason: string) => void;
	isSubmitting: boolean;
	copy: FirewallCopy;
	onSubmit: (e: React.FormEvent) => Promise<void>;
}

export function QuarantineForm({
	callerIp,
	fwIp,
	setFwIp,
	fwMode,
	setFwMode,
	fwDuration,
	setFwDuration,
	fwReason,
	setFwReason,
	isSubmitting,
	copy,
	onSubmit,
}: QuarantineFormProps) {
	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<Ban size={16} />
						{copy.formTitle}
					</h2>
					<p className={s.cardSub}>{fill(copy.formSubTemplate, { ip: callerIp || copy.localIp })}</p>
				</div>
			</div>

			<form className={s.formRow} onSubmit={(e) => void onSubmit(e)}>
				<input
					type="text"
					className={`${s.input} ${s.mono}`}
					placeholder={copy.ipPlaceholder}
					value={fwIp}
					onChange={(e) => setFwIp(e.target.value)}
					required
				/>

				<select
					className={s.select}
					value={fwMode}
					onChange={(e) => setFwMode(e.target.value as 'ban' | 'whitelist')}
				>
					<option value="ban">{copy.modeBan}</option>
					<option value="whitelist">{copy.modeWhitelist}</option>
				</select>

				{fwMode === 'ban' && (
					<select className={s.select} value={fwDuration} onChange={(e) => setFwDuration(e.target.value)}>
						<option value="15">{copy.dur15m}</option>
						<option value="60">{copy.dur1h}</option>
						<option value="120">{copy.dur2h}</option>
						<option value="1440">{copy.dur24h}</option>
						<option value="permanent">{copy.durPermanent}</option>
					</select>
				)}

				<input
					type="text"
					className={`${s.input} ${s.inputGrow}`}
					placeholder={fwMode === 'ban' ? copy.reasonBanPlaceholder : copy.reasonWhitelistPlaceholder}
					value={fwReason}
					onChange={(e) => setFwReason(e.target.value)}
				/>

				<button
					type="submit"
					className={`${s.actionBtn} ${fwMode === 'ban' ? s.actionBtnDanger : s.actionBtnPrimary}`}
					disabled={isSubmitting || !fwIp.trim()}
					style={{ padding: '8px 14px' }}
				>
					{fwMode === 'ban' ? <Ban size={14} /> : <CheckCircle2 size={14} />}
					<span>{fwMode === 'ban' ? copy.submitBan : copy.submitWhitelist}</span>
				</button>
			</form>
		</section>
	);
}
