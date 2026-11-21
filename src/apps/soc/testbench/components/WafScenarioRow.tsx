'use client';

import React from 'react';
import { CheckCircle2, XCircle, Terminal } from 'lucide-react';
import s from './Testbench.module.css';
import type { AttackScenario } from './wafScenarios';
import type { WafSimulatorCopy } from './i18nWafSimulator';

interface WafScenarioRowProps {
	scenario: AttackScenario;
	isExpanded: boolean;
	copy: WafSimulatorCopy;
	onToggleExpand: (id: string) => void;
}

export function WafScenarioRow({
	scenario: sc,
	isExpanded,
	copy,
	onToggleExpand,
}: WafScenarioRowProps) {
	const isTested = sc.status !== undefined;

	return (
		<React.Fragment>
			<tr>
				<td>
					<div style={{ fontWeight: 600, fontSize: '12px' }}>{sc.name}</div>
				</td>
				<td>
					<span className={s.badge} style={{ fontSize: '10.5px' }}>
						{sc.category}
					</span>
				</td>
				<td className={s.mono} style={{ fontSize: '11px' }}>
					{sc.endpoint}
				</td>
				<td>
					{isTested ? (
						<span
							style={{
								fontFamily: 'monospace',
								fontSize: '11px',
								fontWeight: 700,
								color: sc.status === 403 ? 'var(--danger)' : sc.status === 404 ? 'var(--warning)' : 'var(--text-primary)',
							}}
						>
							{sc.status}
						</span>
					) : (
						<span style={{ color: 'var(--text-tertiary)' }}>—</span>
					)}
				</td>
				<td>
					{isTested ? (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
								fontSize: '11px',
								fontWeight: 700,
								padding: '2px 8px',
								borderRadius: '4px',
								background: sc.blocked ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--danger) 15%, transparent)',
								color: sc.blocked ? 'var(--success)' : 'var(--danger)',
							}}
						>
							{sc.blocked ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
							{sc.blocked ? copy.intercepted : copy.passed}
						</span>
					) : (
						<span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
							{copy.idle}
						</span>
					)}
				</td>
				<td className={s.mono} style={{ fontSize: '11px' }}>
					{sc.latencyMs !== undefined ? `${sc.latencyMs} ms` : '—'}
				</td>
				<td>
					<button
						type="button"
						className={s.btn}
						style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
						onClick={() => onToggleExpand(sc.id)}
					>
						<Terminal size={11} />
						<span>{isExpanded ? copy.hide : copy.payload}</span>
					</button>
				</td>
			</tr>

			{isExpanded && (
				<tr>
					<td colSpan={7} style={{ background: 'var(--fill-softer)', padding: '12px' }}>
						<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
							<div>
								<strong style={{ color: 'var(--text-secondary)' }}>
									{copy.injectedPayloadLabel}
								</strong>
								<pre
									style={{
										margin: '4px 0 0',
										padding: '8px',
										background: 'var(--window-bg)',
										borderRadius: '6px',
										border: '1px solid var(--border-subtle)',
										fontFamily: 'monospace',
										whiteSpace: 'pre-wrap',
									}}
								>
									{typeof sc.payload === 'object' ? JSON.stringify(sc.payload, null, 2) : String(sc.payload)}
								</pre>
							</div>

							{sc.interceptMessage && (
								<div>
									<strong style={{ color: 'var(--text-secondary)' }}>
										{copy.telemetryResponseLabel}
									</strong>
									<div
										style={{
											marginTop: '4px',
											padding: '6px 8px',
											background: 'color-mix(in srgb, var(--success) 10%, transparent)',
											color: 'var(--success)',
											borderRadius: '4px',
											fontWeight: 600,
										}}
									>
										{sc.interceptMessage}
									</div>
								</div>
							)}
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	);
}
