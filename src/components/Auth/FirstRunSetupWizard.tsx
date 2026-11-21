'use client';

import React from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import styles from './VsCodeSetup.module.css';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { STEP_METAS, type FirstRunSetupWizardProps, type WizardStep } from './setupWizard/setupTypes';
import { useSetupWizard } from './setupWizard/useSetupWizard';
import { StepDatabase } from './setupWizard/StepDatabase';
import { StepIdentity } from './setupWizard/StepIdentity';
import { StepAdmin } from './setupWizard/StepAdmin';
import { StepSmtp } from './setupWizard/StepSmtp';
import { StepLaunch } from './setupWizard/StepLaunch';
import { SetupUnlockGate } from './setupWizard/SetupUnlockGate';

export function FirstRunSetupWizard({ onComplete }: FirstRunSetupWizardProps) {
	const { language, t } = useI18n();
	const wizard = useSetupWizard(onComplete);

	if (wizard.authChecking) {
		return (
			<div className={styles.workbench} style={{ maxWidth: '640px', height: 'auto', padding: '48px', alignItems: 'center', justifyContent: 'center' }}>
				<div className="boot-splash__spinner" style={{ width: '36px', height: '36px' }} />
			</div>
		);
	}

	if (!wizard.setupUnlocked) {
		return (
			<SetupUnlockGate
				unlocking={wizard.unlocking}
				error={wizard.unlockError}
				onUnlock={wizard.handleUnlockSetup}
			/>
		);
	}

	const completedCount = wizard.completedSteps.size;
	const progressPercent = Math.round((completedCount / 5) * 100);
	const activeMeta = STEP_METAS[wizard.currentStep];

	return (
		<div className={styles.workbench}>
			<div className={styles.workbenchBody}>
				<nav className={styles.sidebar} aria-label={t('setupStepsAria')}>
					<div className={styles.sidebarHeader}>
						<div className={styles.sidebarSectionTag}>{t('setupWalkthroughTag')}</div>
						<h2 className={styles.sidebarTitle}>{t('setupGettingStarted')}</h2>
						<div className={styles.progressTrack}>
							<div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
						</div>
						<div className={styles.progressLabel}>
							{fill(t('setupProgressLabel'), { done: completedCount, pct: progressPercent })}
						</div>
					</div>

					<div className={styles.stepList}>
						{([1, 2, 3, 4, 5] as WizardStep[]).map((stepNum) => {
							const meta = STEP_METAS[stepNum];
							const isActive = wizard.currentStep === stepNum;
							const isDone = wizard.completedSteps.has(stepNum);

							return (
								<button
									key={stepNum}
									type="button"
									onClick={() => wizard.goToStep(stepNum)}
									className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''}`}
								>
									<div
										className={`${styles.stepBadge} ${
											isDone
												? styles.stepBadgeDone
												: isActive
													? styles.stepBadgeActive
													: styles.stepBadgePending
										}`}
									>
										{isDone ? <Check size={12} /> : stepNum}
									</div>
									<div className={styles.stepItemInfo}>
										<span className={styles.stepItemTitle}>{meta.navTitle}</span>
										<span className={styles.stepItemSubtitle}>{meta.navSubtitle}</span>
									</div>
								</button>
							);
						})}
					</div>
				</nav>

				<main className={styles.canvas}>
					<div className={styles.selectionHeader}>
						<div className={styles.selectionStepPill}>
							{fill(t('setupStepPill'), { num: activeMeta.number, title: activeMeta.navTitle.toUpperCase() })}
						</div>
						<h1 className={styles.selectionTitle}>{activeMeta.title}</h1>
						<p className={styles.selectionDescription}>{activeMeta.description}</p>
					</div>

					{wizard.error && (
						<div className={styles.alertError}>
							<AlertCircle size={16} style={{ flexShrink: 0 }} />
							<span>{wizard.error}</span>
						</div>
					)}

					{wizard.currentStep === 1 && (
						<StepDatabase
							dbConnected={wizard.dbConnected}
							dbName={wizard.dbName}
							detectedCandidates={wizard.detectedCandidates}
							scanningDb={wizard.scanningDb}
							testingDb={wizard.testingDb}
							dbUrl={wizard.dbUrl}
							onDbUrlChange={wizard.setDbUrl}
							dbTestResult={wizard.dbTestResult}
							generatedDbPassword={wizard.generatedDbPassword}
							onScanDatabases={() => void wizard.scanDatabases()}
							onSelectCandidate={(cand) => void wizard.handleSelectCandidate(cand)}
							onTestDb={wizard.handleTestDb}
						/>
					)}

					{wizard.currentStep === 2 && (
						<StepIdentity
							language={language}
							archetype={wizard.archetype}
							onArchetypeChange={wizard.setArchetype}
							studioName={wizard.studioName}
							onStudioNameChange={wizard.setStudioName}
							communityName={wizard.communityName}
							onCommunityNameChange={wizard.setCommunityName}
							domain={wizard.domain}
							onDomainChange={wizard.setDomain}
						/>
					)}

					{wizard.currentStep === 3 && (
						<StepAdmin
							name={wizard.name}
							onNameChange={wizard.setName}
							surname={wizard.surname}
							onSurnameChange={wizard.setSurname}
							email={wizard.email}
							onEmailChange={wizard.setEmail}
							password={wizard.password}
							onPasswordChange={wizard.setPassword}
							passwordConfirm={wizard.passwordConfirm}
							onPasswordConfirmChange={wizard.setPasswordConfirm}
						/>
					)}

					{wizard.currentStep === 4 && (
						<StepSmtp
							communityName={wizard.communityName}
							domain={wizard.domain}
							smtpHost={wizard.smtpHost}
							onSmtpHostChange={wizard.setSmtpHost}
							smtpPort={wizard.smtpPort}
							onSmtpPortChange={wizard.setSmtpPort}
							smtpFrom={wizard.smtpFrom}
							onSmtpFromChange={wizard.setSmtpFrom}
							smtpUser={wizard.smtpUser}
							onSmtpUserChange={wizard.setSmtpUser}
							smtpPassword={wizard.smtpPassword}
							onSmtpPasswordChange={wizard.setSmtpPassword}
						/>
					)}

					{wizard.currentStep === 5 && (
						<StepLaunch
							language={language}
							launching={wizard.launching}
							archetype={wizard.archetype}
							studioName={wizard.studioName}
							communityName={wizard.communityName}
							domain={wizard.domain}
							name={wizard.name}
							surname={wizard.surname}
							email={wizard.email}
							smtpHost={wizard.smtpHost}
							smtpPort={wizard.smtpPort}
							dbConnected={wizard.dbConnected}
						/>
					)}

					<div className={styles.buttonRow}>
						{wizard.currentStep > 1 ? (
							<button
								type="button"
								onClick={wizard.prevStep}
								disabled={wizard.loading}
								className={styles.btnSecondary}
							>
								<ArrowLeft size={14} />
								<span>{t('setupPrevStep')}</span>
							</button>
						) : (
							<div />
						)}

						{wizard.currentStep < 5 ? (
							<button type="button" onClick={wizard.nextStep} className={styles.btnPrimary}>
								<span>{activeMeta.nextLabel}</span>
								<ArrowRight size={14} />
							</button>
						) : (
							<button
								type="button"
								onClick={wizard.handleCompleteSetup}
								disabled={wizard.loading}
								className={styles.btnPrimary}
								style={{ backgroundColor: '#107c41' }}
							>
								<CheckCircle2 size={15} />
								<span>{t('setupInitLaunch')}</span>
							</button>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
