'use client';

import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { MatchMode, RuleAction, SecurityRuleCondition } from '@/lib/securityRules';
import type { FirewallCopy } from './i18nFirewall';
import { RuleConditionsBuilder } from './RuleConditionsBuilder';
import s from '../../../Soc.module.css';

interface RuleCreatorModalProps {
	ruleName: string;
	setRuleName: (v: string) => void;
	ruleDesc: string;
	setRuleDesc: (v: string) => void;
	rulePriority: number;
	setRulePriority: (v: number) => void;
	ruleMatchMode: MatchMode;
	setRuleMatchMode: (v: MatchMode) => void;
	ruleAction: RuleAction;
	setRuleAction: (v: RuleAction) => void;
	rateLimitCount: number;
	setRateLimitCount: (v: number) => void;
	rateLimitWindow: number;
	setRateLimitWindow: (v: number) => void;
	scorePoints: number;
	setScorePoints: (v: number) => void;
	ruleConditions: SecurityRuleCondition[];
	isSavingRule: boolean;
	copy: FirewallCopy;
	onAddCondition: () => void;
	onRemoveCondition: (idx: number) => void;
	onUpdateCondition: (idx: number, patch: Partial<SecurityRuleCondition>) => void;
	onSave: (e: React.FormEvent) => Promise<void>;
	onClose: () => void;
}

export function RuleCreatorModal(props: RuleCreatorModalProps) {
	const { t } = useI18n();
	const { copy } = props;
	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: 'rgba(0,0,0,0.65)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9999,
				padding: 16,
			}}
		>
			<div
				className={s.card}
				style={{
					width: '100%',
					maxWidth: 580,
					maxHeight: '90vh',
					overflowY: 'auto',
					background: 'var(--window-bg, #ffffff)',
					boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
				}}
			>
				<div className={s.cardHeader}>
					<h3 className={s.cardTitle}>
						<ShieldAlert size={16} />
						{copy.creatorTitle}
					</h3>
					<button type="button" className={s.actionBtn} onClick={props.onClose} aria-label={t('close')} style={{ padding: '4px 8px' }}>
						<X size={14} />
					</button>
				</div>

				<form onSubmit={(e) => void props.onSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<div>
						<label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>
							{copy.ruleNameLabel} *
						</label>
						<input
							type="text"
							className={s.input}
							value={props.ruleName}
							onChange={(e) => props.setRuleName(e.target.value)}
							placeholder={copy.ruleNamePlaceholder}
							required
							style={{ width: '100%' }}
						/>
					</div>

					<div>
						<label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>
							{copy.ruleDescLabel}
						</label>
						<input
							type="text"
							className={s.input}
							value={props.ruleDesc}
							onChange={(e) => props.setRuleDesc(e.target.value)}
							placeholder={copy.ruleDescPlaceholder}
							style={{ width: '100%' }}
						/>
					</div>

					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
						<div>
							<label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>
								{copy.priorityLabel}
							</label>
							<input
								type="number"
								className={`${s.input} ${s.mono}`}
								value={props.rulePriority}
								onChange={(e) => props.setRulePriority(Number(e.target.value))}
								min={1}
								max={1000}
								style={{ width: '100%' }}
							/>
						</div>

						<div>
							<label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>
								{copy.matchModeLabel}
							</label>
							<select
								className={s.select}
								value={props.ruleMatchMode}
								onChange={(e) => props.setRuleMatchMode(e.target.value as MatchMode)}
								style={{ width: '100%' }}
							>
								<option value="all">{copy.matchAll}</option>
								<option value="any">{copy.matchAny}</option>
							</select>
						</div>

						<div>
							<label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>
								{copy.actionLabel}
							</label>
							<select
								className={s.select}
								value={props.ruleAction}
								onChange={(e) => props.setRuleAction(e.target.value as RuleAction)}
								style={{ width: '100%' }}
							>
								<option value="block">{t('socRuleActionBlock')}</option>
								<option value="rate_limit">{t('socRuleActionRateLimit')}</option>
								<option value="score">{t('socRuleActionScore')}</option>
								<option value="honeypot">{t('socRuleActionHoneypot')}</option>
								<option value="allow">{t('socRuleActionAllow')}</option>
							</select>
						</div>
					</div>

					{props.ruleAction === 'rate_limit' && (
						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
							<div>
								<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('socRuleMaxRequests')}</label>
								<input
									type="number"
									className={s.input}
									value={props.rateLimitCount}
									onChange={(e) => props.setRateLimitCount(Number(e.target.value))}
									min={1}
									style={{ width: '100%' }}
								/>
							</div>
							<div>
								<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('socRuleWindowMs')}</label>
								<input
									type="number"
									className={s.input}
									value={props.rateLimitWindow}
									onChange={(e) => props.setRateLimitWindow(Number(e.target.value))}
									min={1000}
									style={{ width: '100%' }}
								/>
							</div>
						</div>
					)}

					{props.ruleAction === 'score' && (
						<div>
							<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
								{t('socRuleThreatPoints')}
							</label>
							<input
								type="number"
								className={s.input}
								value={props.scorePoints}
								onChange={(e) => props.setScorePoints(Number(e.target.value))}
								min={1}
								max={100}
								style={{ width: '100%' }}
							/>
						</div>
					)}

					<RuleConditionsBuilder
						conditions={props.ruleConditions}
						copy={copy}
						onAdd={props.onAddCondition}
						onRemove={props.onRemoveCondition}
						onUpdate={props.onUpdateCondition}
					/>

					<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
						<button type="button" className={s.actionBtn} onClick={props.onClose}>
							{copy.cancelBtn}
						</button>
						<button type="submit" className={`${s.actionBtn} ${s.actionBtnPrimary}`} disabled={props.isSavingRule}>
							{props.isSavingRule ? copy.savingBtn : copy.saveRuleBtn}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
