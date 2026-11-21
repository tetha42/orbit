'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import contract from './decisions.contract.json';
import { cardStyle, gridStyle, inputStyle, labelStyle, type MemberOption } from './types';

interface CreateCommitteeFormProps {
	members: MemberOption[];
	busy: boolean;
	onCancel: () => void;
	onCreate: (payload: { name: string; description: string; quorum: number; leadId?: string }) => Promise<boolean>;
}

export function CreateCommitteeForm({ members, busy, onCancel, onCreate }: CreateCommitteeFormProps) {
	const { t } = useI18n();
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [quorum, setQuorum] = useState('3');
	const [leaderId, setLeaderId] = useState('');

	const handleSubmit = async () => {
		const ok = await onCreate({
			name,
			description,
			quorum: Number(quorum) || 0,
			leadId: leaderId || undefined,
		});
		if (ok) {
			setName('');
			setDescription('');
		}
	};

	return (
		<div style={cardStyle}>
			<div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>{t('gvNewCommittee')}</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				<div>
					<label style={labelStyle}>{t('gvCommitteeName')}</label>
					<input
						style={inputStyle}
						maxLength={contract.limits.maxTitleLength}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</div>
				<div>
					<label style={labelStyle}>{t('gvDescription')}</label>
					<textarea
						style={{ ...inputStyle, minHeight: 56 }}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>
				<div style={gridStyle}>
					<div>
						<label style={labelStyle}>{t('gvQuorum')}</label>
						<input style={inputStyle} type="number" min={0} value={quorum} onChange={(e) => setQuorum(e.target.value)} />
					</div>
					<div>
						<label style={labelStyle}>{t('gvLeader')}</label>
						<select style={inputStyle} value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
							<option value="">{t('gvNoLeader')}</option>
							{members.map((m) => (
								<option key={m.id} value={m.id}>
									{m.name} {m.surname}
								</option>
							))}
						</select>
					</div>
				</div>
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
					<button type="button" className={ui.btn} onClick={onCancel}>
						{t('gvCancel')}
					</button>
					<button type="button" className={ui.primaryBtn} disabled={busy} onClick={() => void handleSubmit()}>
						{t('gvSave')}
					</button>
				</div>
			</div>
		</div>
	);
}
