'use client';

import { useEffect } from 'react';
import { FirstRunSetupWizard } from './FirstRunSetupWizard';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { TwoFactorForm } from './TwoFactorForm';
import { Notice } from './AuthControls';
import { useAuthFlow } from './useAuthFlow';
import { useI18n } from '@/core/i18n';
import { useRouter } from 'next/navigation';
import styles from './AuthPortal.module.css';

const USER_ICON = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="22"
		height="22"
		viewBox="0 0 24 24"
		fill="none"
		stroke="#fafafa"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	</svg>
);

export function AuthPortal() {
	const router = useRouter();
	const flow = useAuthFlow();
	const { t, language, setLanguage } = useI18n();

	const heading = flow.challengeToken
		? {
				title: t('auth2faTitle', 'Two-Factor Authentication'),
				subtitle: t('auth2faSubtitle', 'Enter the 6-digit code from your authenticator app or a recovery code.'),
			}
		: flow.activeTab === 'login'
			? {
					title: t('authLoginTitle', 'Sign in to Your Account'),
					subtitle: t('authLoginSubtitle', 'Enter your credentials to access the Orbit Community OS workspace.'),
				}
			: {
					title: t('authRegisterTitle', 'Join the Community'),
					subtitle: t('authRegisterSubtitle', 'Submit your membership application to join the workspace.'),
				};

	const showSetup = flow.kurulum?.firstRun || flow.kurulumEksik;

	useEffect(() => {
		if (showSetup) {
			router.replace('/setup');
		}
	}, [showSetup, router]);

	if (showSetup) {
		return (
			<div className="boot-splash" aria-hidden="true">
				<span className="boot-splash__spinner" />
			</div>
		);
	}

	return (
		<div className={styles.shell}>
			<div className={styles.vignette} aria-hidden="true" />

			<header className={styles.header}>
				<div className={styles.brand}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						className={styles.brandLogo}
						src="/assets/img/logo-girdap.svg"
						alt="Orbit Community OS"
					/>
					<span className={styles.brandName}>
						<strong>ORBIT</strong>
						<span>{'// TETHA42'}</span>
					</span>
				</div>

				<nav className={styles.nav}>
					<div
						style={{
							display: 'inline-flex',
							border: '1px solid #27272a',
							borderRadius: '6px',
							overflow: 'hidden',
							background: '#111113',
						}}
					>
						<button
							type="button"
							onClick={() => setLanguage('en')}
							style={{
								padding: '4px 10px',
								border: 'none',
								background: language === 'en' ? '#fafafa' : 'transparent',
								color: language === 'en' ? '#09090b' : '#a1a1aa',
								fontSize: '11px',
								fontWeight: 700,
								cursor: 'pointer',
							}}
						>
							EN
						</button>
						<button
							type="button"
							onClick={() => setLanguage('tr')}
							style={{
								padding: '4px 10px',
								border: 'none',
								background: language === 'tr' ? '#fafafa' : 'transparent',
								color: language === 'tr' ? '#09090b' : '#a1a1aa',
								fontSize: '11px',
								fontWeight: 700,
								cursor: 'pointer',
							}}
						>
							TR
						</button>
					</div>
				</nav>
			</header>

			<main className={styles.main}>
				<div className={styles.card}>
					{showSetup ? (
						<FirstRunSetupWizard onComplete={() => router.push('/')} />
					) : (
						<>
							{!flow.challengeToken && (
								<div className={styles.tabs}>
									<button
										type="button"
										className={`${styles.tab} ${flow.activeTab === 'login' ? styles.tabActive : ''}`}
										onClick={() => flow.switchTab('login')}
									>
										{t('authTabLogin', 'Sign In')}
									</button>
									<button
										type="button"
										className={`${styles.tab} ${flow.activeTab === 'register' ? styles.tabActive : ''}`}
										onClick={() => flow.switchTab('register')}
									>
										{t('authTabRegister', 'Create Account')}
									</button>
								</div>
							)}

							<div className={styles.avatar}>{USER_ICON}</div>

							<div className={styles.cardHeading}>
								<h2>{heading.title}</h2>
								<p>{heading.subtitle}</p>
							</div>

							{flow.sessionConflict && (
								<Notice tone="error" title={t('authSessionEndedTitle', 'Session Terminated')}>
									{t('authSessionEndedBody', 'Your session on this device was closed because your account signed in on another device.')}
								</Notice>
							)}

							{flow.pendingNotice && (
								<Notice tone="warning" title={t('authPendingApprovalTitle', 'Pending Approval')}>
									{flow.pendingNotice}
								</Notice>
							)}

							{flow.errorMessage && <Notice tone="error">{flow.errorMessage}</Notice>}

							{flow.successMessage && <Notice tone="success">{flow.successMessage}</Notice>}

							{flow.challengeToken ? (
								<TwoFactorForm flow={flow} />
							) : flow.activeTab === 'login' ? (
								<LoginForm flow={flow} />
							) : (
								<RegisterForm flow={flow} />
							)}
						</>
					)}
				</div>

				<div className={styles.hero}>
					<div className={styles.heroBar} />
					<h1 className={styles.heroTitle}>
						Orbit
						<br />
						<span>Community OS</span>
					</h1>
					<p className={styles.heroSubtitle}>
						{t('authHeroSubtitle', 'Self-hosted digital workspace, community governance, and engineering suite — by tetha42.')}
					</p>
				</div>
			</main>

			<footer className={styles.footer}>
				<div>ORBIT COMMUNITY OS // TETHA42</div>
				<div>ZERO-CONFIG SELF-HOSTED PLATFORM</div>
			</footer>
		</div>
	);
}
