'use client';

import React from 'react';
import { Trophy, Medal } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { MemberRankItem } from '../types';

interface LeaderboardTabProps {
	topMembers: MemberRankItem[];
	currentUserId: string | null;
}

export function LeaderboardTab({ topMembers, currentUserId }: LeaderboardTabProps) {
	const { t } = useI18n();

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
				<div>
					<h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Trophy size={18} color="#ffd60a" />
						<span>{t('certsLeaderboardHeader')}</span>
					</h3>
					<p style={{ margin: 0, fontSize: '12.5px', opacity: 0.7 }}>
						{t('certsLeaderboardSub')}
					</p>
				</div>
			</div>

			<div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
					<thead>
						<tr style={{ background: 'rgba(255, 255, 255, 0.06)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
							<th style={{ padding: '12px 16px', width: '60px' }}>{t('certsRank')}</th>
							<th style={{ padding: '12px 16px' }}>{t('certsMemberName')}</th>
							<th style={{ padding: '12px 16px' }}>{t('certsDeptYear')}</th>
							<th style={{ padding: '12px 16px' }}>{t('certsTeamRole')}</th>
							<th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('certsTotalXp')}</th>
						</tr>
					</thead>
					<tbody>
						{topMembers.map((member, index) => {
							const isMe = member.id === currentUserId;
							const rankElement =
								index === 0 ? (
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
										<Trophy size={15} color="#ffd60a" /> 1.
									</span>
								) : index === 1 ? (
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
										<Medal size={15} color="#d1d5db" /> 2.
									</span>
								) : index === 2 ? (
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
										<Medal size={15} color="#cd7f32" /> 3.
									</span>
								) : (
									`${index + 1}.`
								);
							return (
								<tr
									key={member.id}
									style={{
										borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
										background: isMe ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
									}}
								>
									<td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px' }}>
										{rankElement}
									</td>
									<td style={{ padding: '12px 16px' }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
											<div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #0a84ff, #5e5ce6)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
												{member.ad[0]}{member.soyad[0]}
											</div>
											<span style={{ fontWeight: isMe ? 700 : 500 }}>
												{member.ad} {member.soyad} {isMe && ` ${t('certsYou')}`}
											</span>
										</div>
									</td>
									<td style={{ padding: '12px 16px', opacity: 0.8, fontSize: '12px' }}>
										{member.bolum} ({fill(t('membersClassYear'), { year: member.sinif })})
									</td>
									<td style={{ padding: '12px 16px' }}>
										<span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.08)', fontSize: '11px' }}>
											{member.takimAdi || member.rolAd || '—'}
										</span>
									</td>
									<td style={{ padding: '12px 16px', textAlign: 'right' }}>
										<span style={{ fontWeight: 800, color: '#ff9500', background: 'rgba(255, 149, 0, 0.15)', padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
											{member.xp || 0} XP
										</span>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
