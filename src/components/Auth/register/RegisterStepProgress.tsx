'use client';

import { Check } from 'lucide-react';
import styles from '../AuthPortal.module.css';
import type { WizardStep } from './useRegisterConfig';

interface StepItem {
	id: WizardStep;
	label: string;
}

export function RegisterStepProgress({
	steps,
	wizardStep,
	stepIndex,
	stepsAriaLabel,
	eyebrow,
	title,
	subtitle,
	hpWebsite,
	onHpChange,
}: {
	steps: StepItem[];
	wizardStep: WizardStep;
	stepIndex: number;
	stepsAriaLabel: string;
	eyebrow: string;
	title: string;
	subtitle: string;
	hpWebsite: string;
	onHpChange: (value: string) => void;
}) {
	return (
		<>
			<div
				style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }}
				aria-hidden="true"
			>
				<input
					type="text"
					name="hp_website"
					tabIndex={-1}
					autoComplete="off"
					value={hpWebsite}
					onChange={(e) => onHpChange(e.target.value)}
				/>
			</div>

			<ol className={styles.wizardSteps} aria-label={stepsAriaLabel}>
				{steps.map((step, index) => (
					<li
						key={step.id}
						className={`${styles.wizardStep} ${step.id === wizardStep ? styles.wizardStepActive : ''} ${
							index < stepIndex ? styles.wizardStepDone : ''
						}`}
					>
						<span className={styles.wizardStepNumber}>
							{index < stepIndex ? <Check size={12} strokeWidth={3} /> : index + 1}
						</span>
						<span className={styles.wizardStepLabel}>{step.label}</span>
					</li>
				))}
			</ol>

			<div className={styles.wizardHeader}>
				<div className={styles.wizardEyebrow}>{eyebrow}</div>
				<h3 className={styles.wizardTitle}>{title}</h3>
				<p className={styles.wizardSubtitle}>{subtitle}</p>
			</div>
		</>
	);
}
